interface ApiRequestConfig {
    method: string;
    url: string;
    params?: Record<string, any>;
    data?: any;
    headers?: Record<string, string>;
}

interface ApiResponse {
    status: number;
    body: any;
    cookie?: string[];
    headers?: Record<string, string>;
}

interface RequestConfig {
    params?: Record<string, any>;
    data?: any;
    headers?: Record<string, string>;
}

let isAuthExpiredNotified = false;

const buildAuthHeader = async (skipAuth: boolean): Promise<string> => {
    if (skipAuth) return '';

    const authParts: string[] = [];

    try {
        const { useUserStore } = await import('@renderer/stores/user');
        const { useDeviceStore } = await import('@renderer/stores/device');

        const userStore = useUserStore();
        const deviceStore = useDeviceStore();

        if (userStore.info) {
            if (userStore.info.token) authParts.push(`token=${userStore.info.token}`);
            if (userStore.info.userid) authParts.push(`userid=${userStore.info.userid}`);
            if (userStore.info.t1) authParts.push(`t1=${userStore.info.t1}`);
        }

        if (deviceStore.info) {
            const device = deviceStore.info;
            if (device.dfid) authParts.push(`dfid=${device.dfid}`);
            if (device.mid) authParts.push(`KUGOU_API_MID=${device.mid}`);
            if (device.uuid) authParts.push(`uuid=${device.uuid}`);
            if (device.guid) authParts.push(`KUGOU_API_GUID=${device.guid}`);
            if (device.serverDev) authParts.push(`KUGOU_API_DEV=${device.serverDev}`);
            if (device.mac) authParts.push(`KUGOU_API_MAC=${device.mac}`);
        }
    } catch (e) {
        console.warn('[KugouRequest] Failed to build auth header:', e);
    }

    return authParts.join(';');
};

const checkAuthExpiration = (data: any): boolean => {
    if (!data || typeof data !== 'object') return false;
    return data.error_code === 20018 ||
        (data.msg && typeof data.msg === 'string' && data.msg.includes('登录已过期'));
};

const handleAuthExpired = async (responseStatus: number, data: unknown) => {
    if (responseStatus === 0 || responseStatus === 502) return;

    try {
        const { useUserStore } = await import('@renderer/stores/user');
        const { useAuthStore } = await import('@renderer/stores/auth');

        const userStore = useUserStore();
        const authStore = useAuthStore();

        if (!userStore.isLoggedIn || isAuthExpiredNotified || !checkAuthExpiration(data)) {
            return;
        }

        isAuthExpiredNotified = true;
        authStore.showSessionExpiredDialog();

        window.setTimeout(() => {
            isAuthExpiredNotified = false;
        }, 5000);
    } catch (e) {
        console.warn('[KugouRequest] Failed to handle auth expired:', e);
    }
};

const ipcRequest = async (method: string, url: string, config?: RequestConfig): Promise<any> => {
    const skipAuth = config?.headers?.['X-Skip-Auth'] === '1';
    const headers: Record<string, string> = { ...(config?.headers || {}) };
    delete headers['X-Skip-Auth'];

    const auth = await buildAuthHeader(skipAuth);
    if (auth) {
        headers['Authorization'] = auth;
    }

    const params = {
        ...(config?.params || {}),
    };

    const ipcConfig: ApiRequestConfig = {
        method,
        url,
        params,
        headers,
    };

    if (config?.data) {
        ipcConfig.data = config.data;
    }

    let response: ApiResponse | undefined;
    let error: any = null;

    try {
        response = await (window as any).api?.request?.(ipcConfig);
    } catch (e) {
        error = e;
        response = undefined;
    }

    if (error || !response) {
        console.error(`[KugouRequest] [${method}] ${url} ERROR:`, error?.message || error || 'No response');
        throw error || new Error('No response from API');
    }

    await handleAuthExpired(response.status, response.body);

    if (response.status >= 400) {
        const err = new Error(`Kugou API Error: ${response.status}`);
        (err as any).response = response;
        throw err;
    }

    return response.body;
};

const kugouRequest = {
    get: (url: string, config?: RequestConfig) => ipcRequest('GET', url, config),
    post: (url: string, data?: any, config?: RequestConfig) =>
        ipcRequest('POST', url, { ...config, data }),
};

export default kugouRequest;