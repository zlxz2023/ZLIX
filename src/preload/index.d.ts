export interface LogAPI {
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
}

export interface IpcRendererAPI {
    send: (channel: string, ...args: any[]) => void
    on: (channel: string, callback: (...args: any[]) => void) => void
    off: (channel: string, callback: (...args: any[]) => void) => void
    removeListener: (channel: string, callback: (...args: any[]) => void) => void
    removeAllListeners: (channel: string) => void
}

export interface MpvAPI {
    load: (url: string) => Promise<any>
    play: () => Promise<any>
    pause: () => Promise<any>
    stop: () => Promise<any>
    seek: (time: number) => Promise<any>
    setVolume: (volume: number) => Promise<any>
    getState: () => Promise<any>
    on: (event: string, callback: (...args: any[]) => void) => void
    off: (event: string, callback: (...args: any[]) => void) => void
}

export interface WindowAPI {
    minimize: () => void
    maximize: () => void
    close: () => void
    onMaximized: (callback: (maximized: boolean) => void) => void
}

export interface MainWindowAPI {
    move: (x: number, y: number, width: number, height: number) => void
    getBounds: () => Promise<{ x: number, y: number, width: number, height: number } | null>
    openSettings: () => void
    focus: () => void
}

export interface LyricsWindowAPI {
    toggle: () => void
    close: () => void
    show: () => void
    hide: () => void
    setSize: (width: number, height: number) => void
    setPosition: (x: number, y: number) => void
    move: (x: number, y: number, width: number, height: number) => void
    getBounds: () => Promise<{ x: number, y: number, width: number, height: number } | null>
    setIgnoreMouseEvents: (ignore: boolean) => void
    requestData: () => void
    sendTimeUpdate: (time: number) => void
    sendDurationUpdate: (duration: number) => void
    sendPlayerState: (state: any) => void
    sendLyricsUpdate: (data: any) => void
    sendSettingsUpdate: (settings: any) => void
    controlPlayer: (action: string) => void
    onTimeUpdate: (callback: (time: number) => void) => void
    onDurationUpdate: (callback: (duration: number) => void) => void
    onPlayerState: (callback: (state: any) => void) => void
    onLyricsUpdate: (callback: (lyrics: any) => void) => void
    onSettingsUpdate: (callback: (settings: any) => void) => void
}

export interface UpdateStatus {
    status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
    message?: string
    progress?: number
    version?: string
}

export interface AutoUpdateAPI {
    check: () => Promise<{ success: boolean; error?: string }>
    download: () => Promise<{ success: boolean; error?: string }>
    install: () => Promise<{ success: boolean; error?: string }>
    onStatus: (callback: (status: UpdateStatus) => void) => void
    offStatus: () => void
}

export interface AppAPI {
    getVersion: () => Promise<string>
}

export interface RequestConfig {
    method?: string
    url?: string
    params?: Record<string, any>
    data?: any
    headers?: Record<string, string>
}

export interface ApiAPI {
    request: (config: RequestConfig) => Promise<any>
    clearCache: () => Promise<any>
}

declare global {
    interface Window {
        logger: LogAPI;
        api: {
            log: LogAPI
            ipcRenderer: IpcRendererAPI
            request: ApiAPI['request']
            clearCache: ApiAPI['clearCache']
            mpv: MpvAPI
            window: WindowAPI
            mainWindow: MainWindowAPI
            lyricsWindow: LyricsWindowAPI
            autoUpdate: AutoUpdateAPI
        }
    }
}
