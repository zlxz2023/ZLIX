import { autoUpdater, UpdateInfo, UpdateDownloadedEvent } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'

let mainWindow: BrowserWindow | null = null

export interface UpdateStatus {
    status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
    message?: string
    progress?: number
    version?: string
}

export function initAutoUpdater(window: BrowserWindow): void {
    mainWindow = window

    autoUpdater.forceDevUpdateConfig = true
    autoUpdater.autoDownload = false

    autoUpdater.on('checking-for-update', () => {
        sendStatus({ status: 'checking', message: '正在检查更新...' })
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
        sendStatus({
            status: 'available',
            message: `发现新版本: ${info.version}`,
            version: info.version
        })
    })

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
        sendStatus({
            status: 'not-available',
            message: `当前已是最新版本: ${info.version}`
        })
    })

    autoUpdater.on('download-progress', (progressObj) => {
        sendStatus({
            status: 'downloading',
            message: `正在下载: ${progressObj.percent?.toFixed(1)}%`,
            progress: progressObj.percent
        })
    })

    autoUpdater.on('update-downloaded', (event: UpdateDownloadedEvent) => {
        sendStatus({
            status: 'downloaded',
            message: '更新已下载完成，即将重启安装...',
            version: event.version
        })
    })

    autoUpdater.on('error', (error: Error) => {
        sendStatus({
            status: 'error',
            message: `更新失败: ${error.message}`
        })
    })

    ipcMain.handle('auto-update:check', async () => {
        try {
            await autoUpdater.checkForUpdates()
            return { success: true }
        } catch (error) {
            return { success: false, error: (error as Error).message }
        }
    })

    ipcMain.handle('auto-update:download', async () => {
        try {
            await autoUpdater.downloadUpdate()
            return { success: true }
        } catch (error) {
            return { success: false, error: (error as Error).message }
        }
    })

    ipcMain.handle('auto-update:install', async () => {
        try {
            autoUpdater.quitAndInstall()
            return { success: true }
        } catch (error) {
            return { success: false, error: (error as Error).message }
        }
    })
}

function sendStatus(status: UpdateStatus): void {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auto-update:status', status)
    }
}

export function checkForUpdatesOnStartup(): void {
    if (process.env.NODE_ENV !== 'development') {
        setTimeout(() => {
            autoUpdater.checkForUpdates().catch(() => { })
        }, 5000)
    }
}