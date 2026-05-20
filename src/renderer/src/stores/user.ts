import { defineStore } from 'pinia';

export interface UserExtendsInfo {
    detail?: Record<string, unknown>;
    vip?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface User {
    userid: number;
    token: string;
    username?: string;
    nickname?: string;
    mobile?: string;
    pic?: string;
    expires?: number;
    extends?: UserExtendsInfo;
    extendsInfo?: UserExtendsInfo;
    userId?: number;
    userName?: string;
    userPic?: string;
    t1?: string;
    vip_type?: number;
    p_grade?: number;
    detail?: Record<string, unknown>;
    vip?: Record<string, unknown>;
}

export type UserInfo = User;

interface ApiPayload {
    status?: number;
    data?: unknown;
    [key: string]: unknown;
}

const asApiPayload = (value: unknown): ApiPayload | null => {
    if (!value || typeof value !== 'object') return null;
    return value as ApiPayload;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const mergeExtendsInfo = (
    ...sources: Array<UserExtendsInfo | undefined>
): UserExtendsInfo | undefined => {
    const merged = sources.reduce<UserExtendsInfo>((acc, source) => {
        if (!source) return acc;
        return {
            ...acc,
            ...source,
            detail: isRecord(source.detail)
                ? {
                    ...(isRecord(acc.detail) ? acc.detail : {}),
                    ...source.detail,
                }
                : acc.detail,
            vip: isRecord(source.vip)
                ? {
                    ...(isRecord(acc.vip) ? acc.vip : {}),
                    ...source.vip,
                }
                : acc.vip,
        };
    }, {});

    return Object.keys(merged).length > 0 ? merged : undefined;
};

const normalizeUserInfo = (info: UserInfo): UserInfo => {
    const next = { ...info };

    if (
        (typeof next.userid !== 'number' || next.userid <= 0) &&
        typeof next.userId === 'number' &&
        next.userId > 0
    ) {
        next.userid = next.userId;
    }
    if (
        (typeof next.userId !== 'number' || next.userId <= 0) &&
        typeof next.userid === 'number' &&
        next.userid > 0
    ) {
        next.userId = next.userid;
    }

    return next;
};

const buildPatchedUserInfo = (current: UserInfo | null, patch: Partial<UserInfo>): UserInfo => {
    return normalizeUserInfo({
        ...(current ?? { userid: 0, token: '' }),
        ...patch,
    });
};

export const useUserStore = defineStore('user', {
    state: () => ({
        info: null as UserInfo | null,
        isLoggedIn: false,
        hasFetchedUserInfo: false,
        isFetchingUserInfo: false,
        isTvipClaimedToday: false,
        isSvipClaimedToday: false,
        isAutoClaimingVip: false,
        followedArtistIds: new Set<string>(),
        hasFetchedFollowedArtists: false,
    }),
    actions: {
        setUserInfo(info: UserInfo) {
            const nextInfo = normalizeUserInfo(info);
            this.$patch((state) => {
                state.info = nextInfo;
                state.isLoggedIn = !!nextInfo.token;
                if (!nextInfo.token) {
                    state.hasFetchedUserInfo = false;
                }
            });
        },
        handleLoginSuccess(data: Record<string, unknown>) {
            this.hasFetchedUserInfo = false;

            const mapped = mapUser(data);
            const detailPayload = isRecord(data.detail)
                ? data.detail
                : isRecord(data.extendsInfo) &&
                    isRecord((data.extendsInfo as Record<string, unknown>).detail)
                    ? ((data.extendsInfo as Record<string, unknown>).detail as Record<string, unknown>)
                    : isRecord(data)
                        ? data
                        : undefined;

            const vipPayload = isRecord(data.vip)
                ? data.vip
                : isRecord(data.extendsInfo) && isRecord((data.extendsInfo as Record<string, unknown>).vip)
                    ? ((data.extendsInfo as Record<string, unknown>).vip as Record<string, unknown>)
                    : undefined;

            const mergedExtends = mergeExtendsInfo(
                this.info?.extendsInfo,
                mapped.extendsInfo,
                detailPayload ? { detail: detailPayload } : undefined,
                vipPayload ? { vip: vipPayload } : undefined,
            );

            const nextInfo = buildPatchedUserInfo(this.info, {
                ...mapped,
                ...(mergedExtends
                    ? {
                        extends: mergedExtends,
                        extendsInfo: mergedExtends,
                        ...(mergedExtends.detail ? { detail: mergedExtends.detail } : {}),
                        ...(mergedExtends.vip ? { vip: mergedExtends.vip } : {}),
                    }
                    : {}),
            });

            this.setUserInfo(nextInfo);
        },
        async fetchUserInfo() {
            if (!this.isLoggedIn) return;
            try {
                const { getUserDetail, getUserVipDetail } = await import('@renderer/api/kugou/user');
                const [detailRes, vipRes] = await Promise.all([getUserDetail(), getUserVipDetail()]);
                const detailPayload = asApiPayload(detailRes);
                const vipPayload = asApiPayload(vipRes);

                if (detailPayload?.status === 1) {
                    const payload =
                        detailPayload.data && typeof detailPayload.data === 'object'
                            ? (detailPayload.data as Record<string, unknown>)
                            : detailPayload;
                    this.handleLoginSuccess(payload);
                }

                if (vipPayload?.status === 1 && this.info) {
                    const vipData =
                        vipPayload.data && typeof vipPayload.data === 'object'
                            ? (vipPayload.data as Record<string, unknown>)
                            : undefined;
                    const mergedExtends = mergeExtendsInfo(
                        this.info.extendsInfo,
                        vipData ? { vip: vipData } : undefined,
                    );

                    this.setUserInfo(
                        buildPatchedUserInfo(this.info, {
                            ...(vipData ? { vip: vipData } : {}),
                            ...(mergedExtends ? { extends: mergedExtends, extendsInfo: mergedExtends } : {}),
                        }),
                    );
                }
            } catch (e) {
                console.error('[UserStore] Fetch user info error:', e);
            }
        },
        async fetchUserInfoOnce() {
            if (!this.isLoggedIn || this.hasFetchedUserInfo || this.isFetchingUserInfo) return;
            this.isFetchingUserInfo = true;
            try {
                await this.fetchUserInfo();
                this.hasFetchedUserInfo = true;
            } finally {
                this.isFetchingUserInfo = false;
            }
        },
        async autoReceiveVipIfNeeded() {
            if (!this.isLoggedIn || this.isAutoClaimingVip) return;
            this.isAutoClaimingVip = true;

            try {
                const today = await this.getServerToday();
                const { claimDayVip, upgradeDayVip } = await import('@renderer/api/kugou/user');

                try {
                    await claimDayVip(today);
                } catch (e) {
                    console.warn('[UserStore] VIP claim: claimDayVip failed', e);
                }

                try {
                    await upgradeDayVip();
                } catch (e) {
                    console.warn('[UserStore] VIP claim: upgradeDayVip failed', e);
                }

                try {
                    await this.fetchUserInfo();
                    this.hasFetchedUserInfo = true;
                } catch (e) {
                    console.warn('[UserStore] VIP claim: fetchUserInfo failed', e);
                }
            } catch (error) {
                console.warn('[UserStore] Auto receive VIP unexpected error:', error);
            } finally {
                this.isAutoClaimingVip = false;
            }
        },
        setClaimStatus(tvip: boolean, svip: boolean) {
            this.isTvipClaimedToday = tvip;
            this.isSvipClaimedToday = svip;
        },
        logout() {
            this.info = null;
            this.isLoggedIn = false;
            this.hasFetchedUserInfo = false;
            this.isFetchingUserInfo = false;
            this.isTvipClaimedToday = false;
            this.isSvipClaimedToday = false;
            this.isAutoClaimingVip = false;
            this.followedArtistIds = new Set();
            this.hasFetchedFollowedArtists = false;
            (window as any).electron?.api?.clearCache?.();
        },
        isArtistFollowed(artistId: string | number): boolean {
            return this.followedArtistIds.has(String(artistId));
        },
        addFollowedArtist(artistId: string | number) {
            this.followedArtistIds = new Set([...this.followedArtistIds, String(artistId)]);
        },
        removeFollowedArtist(artistId: string | number) {
            const next = new Set(this.followedArtistIds);
            next.delete(String(artistId));
            this.followedArtistIds = next;
        },
        async fetchFollowedArtists() {
            if (!this.isLoggedIn) return;
            try {
                const { getUserFollow } = await import('@renderer/api/kugou/user');
                const res = await getUserFollow();
                if (res && typeof res === 'object' && 'data' in res) {
                    const data = (res as { data?: { lists?: unknown[] } }).data;
                    const lists = Array.isArray(data?.lists) ? data.lists : [];
                    const ids = new Set<string>();
                    for (const item of lists) {
                        const record = item as Record<string, unknown>;
                        const id = String(record.singerid ?? record.userid ?? record.id ?? '');
                        if (id) ids.add(id);
                    }
                    this.followedArtistIds = ids;
                    this.hasFetchedFollowedArtists = true;
                }
            } catch (e) {
                console.warn('[UserStore] Fetch followed artists failed', e);
            }
        },
        async ensureFollowedArtists() {
            if (this.hasFetchedFollowedArtists) return;
            await this.fetchFollowedArtists();
        },
        async getServerToday(): Promise<string> {
            try {
                const kugouApi = await import('@renderer/api/kugou/user');
                const res = await kugouApi.getServerNow();
                if (res && typeof res === 'object') {
                    const record = res as unknown as Record<string, unknown>;
                    const source = (
                        record.data && typeof record.data === 'object' ? record.data : record
                    ) as Record<string, unknown>;
                    const candidates = [
                        source.now,
                        source.time,
                        source.timestamp,
                        source.server_time,
                        source.serverTime,
                    ];
                    for (const candidate of candidates) {
                        const value = Number(candidate);
                        if (Number.isFinite(value) && value > 0) {
                            const ms = value > 1e12 ? value : value * 1000;
                            const date = new Date(ms);
                            const offset = 8 * 60;
                            const local = new Date(date.getTime() + offset * 60 * 1000);
                            return local.toISOString().split('T')[0];
                        }
                    }
                }
            } catch (e) {
                console.warn('[UserStore] Failed to get server time, using local time', e);
            }
            const now = new Date();
            const offset = 8 * 60;
            const local = new Date(now.getTime() + offset * 60 * 1000);
            return local.toISOString().split('T')[0];
        },
    },
    persist: {
        omit: [
            'hasFetchedUserInfo',
            'isFetchingUserInfo',
            'isAutoClaimingVip',
            'followedArtistIds',
            'hasFetchedFollowedArtists',
        ],
    },
});

const EMPTY_RECORD: Record<string, unknown> = {};

const getRecord = (record: unknown, key: string): Record<string, unknown> | undefined => {
    if (!isRecord(record)) return undefined;
    const value = record[key];
    return isRecord(value) ? value : undefined;
};

const parseIntSafe = (value: unknown): number | undefined => {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
};

const parseOptionalInt = (value: unknown): number | undefined => {
    return parseIntSafe(value);
};

const pickValue = (...values: unknown[]): unknown => {
    for (const value of values) {
        if (value !== undefined && value !== null) {
            return value;
        }
    }
    return undefined;
};

const readString = (value: unknown, defaultValue: string): string => {
    if (typeof value === 'string') return value;
    return defaultValue;
};

const toRecord = (json: unknown): Record<string, unknown> => {
    if (isRecord(json)) return json;
    return EMPTY_RECORD;
};

const mapUser = (json: unknown): Partial<User> => {
    const record = toRecord(json);
    const data = getRecord(record, 'data') ?? EMPTY_RECORD;
    const info = getRecord(record, 'info') ?? EMPTY_RECORD;
    const userInfo = getRecord(record, 'userinfo') ?? getRecord(record, 'user_info') ?? EMPTY_RECORD;
    const profile = getRecord(record, 'profile') ?? EMPTY_RECORD;
    const account = getRecord(record, 'account') ?? EMPTY_RECORD;
    const primary =
        Object.keys(userInfo).length > 0
            ? userInfo
            : Object.keys(profile).length > 0
                ? profile
                : Object.keys(info).length > 0
                    ? info
                    : Object.keys(data).length > 0
                        ? data
                        : record;

    const extendsInfo = isRecord(record.extends)
        ? record.extends
        : isRecord(record.extendsInfo)
            ? record.extendsInfo
            : isRecord(primary.extends)
                ? primary.extends
                : isRecord(primary.extendsInfo)
                    ? primary.extendsInfo
                    : EMPTY_RECORD;

    const detail =
        getRecord(record, 'detail') ?? getRecord(primary, 'detail') ?? getRecord(extendsInfo, 'detail');
    const vip =
        getRecord(record, 'vip') ?? getRecord(primary, 'vip') ?? getRecord(extendsInfo, 'vip');

    const useridRaw = pickValue(
        record.userid,
        record.userId,
        record.user_id,
        record.uid,
        record.id,
        primary.userid,
        primary.userId,
        primary.user_id,
        primary.uid,
        primary.id,
        account.userid,
        account.userId,
        account.user_id,
        account.uid,
        account.id,
        detail?.userid,
        detail?.userId,
        detail?.user_id,
        detail?.uid,
        detail?.id,
    );
    const userid = useridRaw !== undefined ? parseIntSafe(useridRaw) : undefined;

    const token = readString(pickValue(record.token, primary.token, account.token), '').trim();
    const username = readString(
        pickValue(
            primary.username,
            primary.userName,
            record.username,
            record.userName,
            account.username,
        ),
        '',
    ).trim();
    const nickname = readString(
        pickValue(
            primary.nickname,
            primary.userName,
            primary.username,
            record.nickname,
            record.userName,
            username,
        ),
        '',
    ).trim();
    const pic = readString(
        pickValue(
            primary.pic,
            primary.userPic,
            primary.avatar,
            profile.avatarUrl,
            profile.avatar,
            record.pic,
            record.userPic,
            record.avatar,
        ),
        '',
    ).trim();
    const mobile = readString(pickValue(primary.mobile, record.mobile, account.mobile), '').trim();
    const t1 = readString(pickValue(record.t1, primary.t1, account.t1), '').trim();
    const expiresRaw = pickValue(primary.expires, record.expires, account.expires);
    const vipTypeRaw = pickValue(primary.vip_type, record.vip_type, vip?.vip_type);
    const pGradeRaw = pickValue(primary.p_grade, record.p_grade, detail?.p_grade);
    const expires = expiresRaw !== undefined ? parseOptionalInt(expiresRaw) : undefined;
    const vipType = vipTypeRaw !== undefined ? parseOptionalInt(vipTypeRaw) : undefined;
    const pGrade = pGradeRaw !== undefined ? parseOptionalInt(pGradeRaw) : undefined;
    const mergedExtends =
        Object.keys(extendsInfo).length > 0 || detail || vip
            ? {
                ...extendsInfo,
                ...(detail ? { detail } : {}),
                ...(vip ? { vip } : {}),
            }
            : undefined;

    const patch: Partial<User> = {};
    if (typeof userid === 'number' && userid > 0) {
        patch.userid = userid;
        patch.userId = userid;
    }
    if (token) patch.token = token;
    if (username) patch.username = username;
    if (nickname || username) {
        patch.nickname = nickname || username;
        patch.userName = nickname || username;
    }
    if (mobile) patch.mobile = mobile;
    if (pic) {
        patch.pic = pic;
        patch.userPic = pic;
    }
    if (t1) patch.t1 = t1;
    if (typeof expires === 'number' && expires > 0) patch.expires = expires;
    if (typeof vipType === 'number') patch.vip_type = vipType;
    if (typeof pGrade === 'number') patch.p_grade = pGrade;
    if (detail) patch.detail = detail;
    if (vip) patch.vip = vip;
    if (mergedExtends) {
        patch.extends = mergedExtends;
        patch.extendsInfo = mergedExtends;
    }

    return patch;
};