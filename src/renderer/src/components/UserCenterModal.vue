<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '@renderer/stores/user'
import {
    claimDayVip,
    upgradeDayVip,
    getUserVipDetail,
    getVipMonthRecord
} from '@renderer/api/kugou/user'
import CloseIcon from '@renderer/assets/icons/close.svg'
import { logger } from '@renderer/utils/logger'

const emit = defineEmits<{
    (e: 'close'): void
}>()
const userStore = useUserStore()
const isVisible = ref(false)
const vipDetail = ref<any>(null)
const isClaiming = ref(false)
const isUpgrading = ref(false)
const show = () => {
    isVisible.value = true
    loadData()
}
const hide = () => {
    isVisible.value = false
    vipDetail.value = null
}
const emitClose = () => {
    emit('close')
    hide()
}
const loadData = async () => {
    if (!userStore.isLoggedIn) return
    try {
        await userStore.fetchUserInfo()
        const [vipRes, recordRes] = await Promise.all([getUserVipDetail(), getVipMonthRecord()])
        console.log(vipRes)
        console.log(recordRes)
        const vipData = vipRes.data
        if (vipData && typeof vipData === 'object') {
            vipDetail.value = { ...vipData }
        } else {
            vipDetail.value = null
        }
        const today = await userStore.getServerToday()
        const recordList = Array.isArray(recordRes.data.list) ? recordRes.data.list : []
        // 现在签到记录正常存在tvip
        // 畅听会员
        // const isTvipClaimed = recordList.some((item: any) => typeof item === 'object' && item.day === today && item.vip_type === 'tvip');
        const isTvipClaimed = recordList.some(
            (item: any) =>
                typeof item === 'object' &&
                item.day === today &&
                (item.vip_type === 'tvip' || item.vip_type === 'svip')
        )
        // 概念会员
        const isSvipClaimed = recordList.some(
            (item: any) =>
                typeof item === 'object' && item.day === today && item.vip_type === 'svip'
        )
        userStore.setClaimStatus(isTvipClaimed, isSvipClaimed)
    } catch (e: any) {
        logger.error('UserCenter', '加载用户数据失败', e)
    }
}
const handleLogout = () => {
    userStore.logout()
    emitClose()
}
const handleClaimVip = async () => {
    if (isClaiming.value || userStore.isTvipClaimedToday) return
    isClaiming.value = true
    try {
        const today = await userStore.getServerToday()
        const res = await claimDayVip(today)
        if (res) {
            userStore.setClaimStatus(true, userStore.isSvipClaimedToday)
            await loadData()
            logger.info('UserCenter', '领取畅听会员成功')
        }
    } catch (e: any) {
        logger.error('UserCenter', '领取畅听会员失败', e)
    } finally {
        isClaiming.value = false
    }
}
const handleUpgradeVip = async () => {
    if (isUpgrading.value || userStore.isSvipClaimedToday) {
        return
    }
    isUpgrading.value = true
    try {
        const res = await upgradeDayVip()
        if (res) {
            userStore.setClaimStatus(userStore.isTvipClaimedToday, true)
            await loadData()
            logger.info('UserCenter', '升级概念会员成功')
        }
    } catch (e: any) {
        logger.error('UserCenter', '升级概念会员失败', e)
    } finally {
        isUpgrading.value = false
    }
}
const getUserPic = computed(() => {
    const pic = userStore.info?.pic || ''
    if (pic && pic.startsWith('http://')) {
        return pic.replace('http://', 'https://')
    }
    return pic
})
const getNickname = computed(() => {
    return userStore.info?.nickname || userStore.info?.username || '未知'
})
const getUserLevel = computed(() => {
    const pGrade = userStore.info?.p_grade
    if (pGrade && pGrade > 0) {
        return `Lv.${pGrade}`
    }
    return 'Lv.0'
})
const userID = computed(() => {
    return userStore.info?.userid || '-'
})
const followCount = computed(() => {
    return userStore.info?.detail?.follow || userStore.info?.extendsInfo?.detail?.follow || 0
})
const fansCount = computed(() => {
    return userStore.info?.detail?.fans || userStore.info?.extendsInfo?.detail?.fans || 0
})
const listenCount = computed(() => {
    return userStore.info?.detail?.listen || userStore.info?.extendsInfo?.detail?.listen || 0
})
const detail = computed(() => {
    return userStore.info?.extendsInfo?.detail || userStore.info?.detail || {}
})
const formatLeLing = (rtime: any) => {
    if (!rtime) return '-'
    const start = new Date(parseInt(rtime) * 1000)
    const diff = Date.now() - start.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days > 365) return `${Math.floor(days / 365)} 年`
    if (days > 30) return `${Math.floor(days / 30)} 个月`
    return `${days} 天`
}
const formatDuration = (minutes: any) => {
    if (!minutes) return '-'
    const m = parseInt(minutes) || 0
    if (m > 60) return `${Math.floor(m / 60)} 小时 ${m % 60} 分钟`
    return `${m} 分钟`
}
const age = computed(() => {
    return formatLeLing(detail.value?.rtime)
})
const listenTime = computed(() => {
    return formatDuration(detail.value?.duration)
})
const gender = computed(() => {
    const g = detail.value?.gender
    return g === 0 ? '男' : g === 1 ? '女' : '保密'
})
const city = computed(() => {
    return detail.value?.loc || detail.value?.city || detail.value?.province || '-'
})
const busiVip = computed(() => {
    return vipDetail.value?.busi_vip || []
})
const tvip = computed(() => {
    return busiVip.value.find((v: any) => v.product_type === 'tvip' && v.is_vip === 1)
})
const svip = computed(() => {
    return busiVip.value.find((v: any) => v.product_type === 'svip' && v.is_vip === 1)
})
const getVipExpireText = (vipData: any) => {
    if (!vipData?.vip_end_time) return null
    try {
        const expireDate = new Date(vipData.vip_end_time)
        const now = new Date()
        const diff = expireDate.getTime() - now.getTime()
        if (diff < 0) return '已过期'
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        if (days > 365) return `${Math.floor(days / 365)}年后到期`
        if (days > 30) return `${Math.floor(days / 30)}个月后到期`
        if (days > 0) return `${days}天后到期`
        return '即将到期'
    } catch {
        return null
    }
}
const tvipExpireText = computed(() => getVipExpireText(tvip.value))
const svipExpireText = computed(() => getVipExpireText(svip.value))
defineExpose({ show, hide })
</script>

<template>
    <Teleport to="body">
        <div v-if="isVisible" class="user-center-overlay select-none" @click.self="emitClose">
            <div class="user-center-modal">
                <div class="user-center-header">
                    <h2>个人中心</h2>
                    <button class="close-btn" @click="emitClose">
                        <img :src="CloseIcon" class="w-4 h-4" />
                    </button>
                </div>

                <div class="user-info-card">
                    <div class="avatar-section">
                        <div class="avatar-wrapper">
                            <img v-if="getUserPic" :src="getUserPic" alt="头像" class="avatar" />
                            <span v-else class="avatar-placeholder">{{
                                getNickname.charAt(0)
                            }}</span>
                        </div>
                        <div class="user-basic">
                            <div class="nickname-row">
                                <h3 class="nickname">{{ getNickname }}</h3>
                                <span v-if="tvip" class="vip-badge ct">畅听</span>
                                <span v-if="svip" class="vip-badge gn">概念</span>
                            </div>
                            <div class="user-stats">
                                <div class="stat-item">
                                    <span class="stat-value">{{ getUserLevel }}</span>
                                    <span class="stat-label">等级</span>
                                </div>
                                <div class="stat-divider"></div>
                                <div class="stat-item">
                                    <span class="stat-value">{{ followCount }}</span>
                                    <span class="stat-label">关注</span>
                                </div>
                                <div class="stat-divider"></div>
                                <div class="stat-item">
                                    <span class="stat-value">{{ fansCount }}</span>
                                    <span class="stat-label">粉丝</span>
                                </div>
                                <div class="stat-divider"></div>
                                <div class="stat-item">
                                    <span class="stat-value">{{ listenCount }}</span>
                                    <span class="stat-label">访客</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="main-content">
                    <div class="user-details">
                        <h4 class="section-title">账号档案</h4>
                        <div class="detail-row">
                            <span class="detail-label">用户ID</span>
                            <span class="detail-value">{{ userID }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">性别</span>
                            <span class="detail-value">{{ gender }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">乐龄</span>
                            <span class="detail-value">{{ age }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">累计听歌</span>
                            <span class="detail-value">{{ listenTime }}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">所在地区</span>
                            <span class="detail-value">{{ city }}</span>
                        </div>
                    </div>

                    <div class="daily-benefits">
                        <h4 class="section-title">每日权益</h4>
                        <div
                            class="benefit-item claim-vip"
                            :class="{ claimed: userStore.isTvipClaimedToday }"
                            @click="handleClaimVip"
                        >
                            <div class="benefit-icon claim-icon">🏠</div>
                            <div class="benefit-content">
                                <div class="benefit-title">领取畅听会员</div>
                                <!-- <div class="benefit-desc">{{tvipExpireText || (userStore.isTvipClaimedToday ? '今日已领取' : '领取会员') }}</div> -->
                                <div class="benefit-desc">{{ tvipExpireText }}</div>
                            </div>
                            <div class="benefit-status">
                                <span v-if="userStore.isTvipClaimedToday" class="claimed-badge"
                                    >✓</span
                                >
                                <span v-else-if="isClaiming" class="claiming-badge">...</span>
                                <span v-else class="claim-arrow">→</span>
                            </div>
                        </div>

                        <div
                            class="benefit-item upgrade-vip"
                            :class="{ upgraded: userStore.isSvipClaimedToday || svip }"
                            @click="handleUpgradeVip"
                        >
                            <div class="benefit-icon upgrade-icon">🎵</div>
                            <div class="benefit-content">
                                <div class="benefit-title">升级概念会员</div>
                                <!-- <div class="benefit-desc">{{ svipExpireText || (userStore.isSvipClaimedToday ? '已领取' : '解锁更多特权') }}</div> -->
                                <div class="benefit-desc">{{ svipExpireText }}</div>
                            </div>
                            <div class="benefit-status">
                                <span
                                    v-if="userStore.isSvipClaimedToday || svip"
                                    class="claimed-badge"
                                    >✓</span
                                >
                                <span v-else class="upgrade-arrow">→</span>
                            </div>
                        </div>
                    </div>
                </div>

                <button class="logout-btn" @click="handleLogout">退出登录</button>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.user-center-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.user-center-modal {
    background: #fff;
    border-radius: 12px;
    width: 70%;
    padding: 24px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    color: #333;
}

.user-center-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.user-center-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #1a1a1a;
}

.close-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: #f0f0f0;
    border-radius: 50%;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #333;
}

.close-btn:hover {
    background: #e0e0e0;
}

.user-info-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 20px;
    color: #fff;
}

.avatar-section {
    display: flex;
    align-items: center;
    gap: 16px;
}

.avatar-wrapper {
    position: relative;
}

.avatar {
    width: 70px;
    height: 70px;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.5);
    object-fit: cover;
}

.avatar-placeholder {
    width: 70px;
    height: 70px;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: bold;
    background: rgba(255, 255, 255, 0.2);
}

.user-basic {
    flex: 1;
}

.nickname-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.nickname {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
}

.vip-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
}

.vip-badge.ct {
    background: #52c41a;
    color: #fff;
}

.vip-badge.gn {
    background: #fa8c16;
    color: #fff;
}

.user-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 12px;
}

.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
}

.stat-value {
    font-size: 16px;
    font-weight: 600;
}

.stat-label {
    font-size: 12px;
    opacity: 0.8;
}

.stat-divider {
    width: 1px;
    height: 24px;
    background: rgba(255, 255, 255, 0.3);
}

.main-content {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
}

.user-details {
    flex: 1;
    background: #fafafa;
    border-radius: 12px;
    padding: 20px;
    width: 60%;
}

.daily-benefits {
    width: 40%;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.section-title {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
}

.daily-benefits .section-title {
    margin-bottom: 8px;
}

.detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #eee;
}

.detail-row:last-child {
    border-bottom: none;
}

.detail-label {
    font-size: 14px;
    color: #666;
}

.detail-value {
    font-size: 14px;
    color: #333;
    font-weight: 500;
}

.benefit-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.benefit-item.claim-vip {
    background: linear-gradient(135deg, #a8e063 0%, #56ab2f 100%);
    color: #fff;
}

.benefit-item.upgrade-vip {
    background: #f5f5f5;
    color: #333;
}

.benefit-item.upgrade-vip.upgraded {
    background: linear-gradient(135deg, #ff9a44 0%, #fa8c16 100%);
    color: #fff;
}

.benefit-item.upgrade-vip.upgraded .benefit-icon {
    background: rgba(255, 255, 255, 0.2);
}

.benefit-item.upgrade-vip.upgraded .upgrade-arrow {
    color: rgba(255, 255, 255, 0.8);
}

.benefit-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.benefit-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    border-radius: 10px;
}

.claim-icon {
    background: rgba(255, 255, 255, 0.2);
}

.upgrade-icon {
    background: #fff;
}

.benefit-content {
    flex: 1;
    min-width: 0;
}

.benefit-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 4px;
}

.benefit-desc {
    font-size: 12px;
    opacity: 0.8;
}

.benefit-status {
    display: flex;
    align-items: center;
    justify-content: center;
}

.claim-arrow {
    font-size: 18px;
    opacity: 0.8;
}

.claimed-badge {
    width: 20px;
    height: 20px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
}

.claiming-badge {
    font-size: 18px;
    animation: pulse 1s infinite;
}

@keyframes pulse {
    0%,
    100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
}

.upgrade-arrow {
    font-size: 18px;
    color: #999;
}

.claim-message {
    font-size: 12px;
    color: #666;
    text-align: center;
    padding: 4px 0;
}

.logout-btn {
    width: 100%;
    padding: 14px;
    border: 1px solid #e74c3c;
    background: #fff;
    color: #e74c3c;
    border-radius: 8px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s;
}

.logout-btn:hover {
    background: #fff5f5;
}
</style>