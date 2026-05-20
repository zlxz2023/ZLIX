import { defineStore } from 'pinia';

export interface DeviceInfo {
    dfid: string;
    mid: string;
    uuid: string;
    guid: string;
    serverDev: string;
    mac: string;
}

export const useDeviceStore = defineStore('device', {
    state: () => ({
        info: null as DeviceInfo | null,
        hasRegistered: false,
    }),
    actions: {
        async registerDevice() {
            if (this.hasRegistered) return;
            try {
                const { registerDevice } = await import('@renderer/api/kugou/user');
                const res = await registerDevice();
                if (res && typeof res === 'object') {
                    const data = res as Record<string, unknown>;
                    this.info = {
                        dfid: String(data.dfid || data.DFID || ''),
                        mid: String(data.mid || data.MID || ''),
                        uuid: String(data.uuid || ''),
                        guid: String(data.guid || ''),
                        serverDev: String(data.serverDev || ''),
                        mac: String(data.mac || '02:00:00:00:00:00'),
                    };
                    this.hasRegistered = true;
                }
            } catch (e) {
                console.error('[DeviceStore] Failed to register device:', e);
            }
        },
        async ensureDeviceInfo() {
            if (this.info) return;
            await this.registerDevice();
        },
        setDeviceInfo(info: Partial<DeviceInfo>) {
            if (!this.info) {
                this.info = {
                    dfid: '',
                    mid: '',
                    uuid: '',
                    guid: '',
                    serverDev: '',
                    mac: '02:00:00:00:00:00',
                };
            }
            Object.assign(this.info, info);
        },
    },
    persist: {
        key: 'device',
    },
});