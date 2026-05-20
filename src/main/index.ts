import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import initAppServer from "./server";
import { initMpvPlayer, getMpvController, destroyMpvPlayer } from './mpv'
import { initKugouServer, registerKugouApiIpcHandler } from './kugou-server'
import initRendererLogIpc from "./ipc-renderer-log";
import { initAutoUpdater, checkForUpdatesOnStartup } from './auto-updater';

let mainWindow: BrowserWindow | null = null
let lyricsWindow: BrowserWindow | null = null

function createWindow(): void {
    // 获取屏幕尺寸
    const { screen } = require('electron')
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize

    // 自定义窗口大小
    const windowWidth = 1000
    const windowHeight = 700

    // 居中位置
    const x = Math.floor((screenWidth - windowWidth) / 2)
    const y = Math.floor((screenHeight - windowHeight) / 2)

    mainWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x: x,
        y: y,
        show: false,
        autoHideMenuBar: true,
        ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            allowRunningInsecureContent: true,
            webSecurity: false
        },
        frame: false
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow?.show()
        mainWindow?.maximize()
    })

    mainWindow.on('maximize', () => {
        mainWindow?.webContents.send('window-maximized', true)
    })

    mainWindow.on('unmaximize', () => {
        mainWindow?.webContents.send('window-maximized', false)
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.whenReady().then(async () => {
        // Set app user model id for windows
        electronApp.setAppUserModelId('com.electron')

        // 初始化日志系统
        initRendererLogIpc();

        // 启动主服务进程
        await initAppServer();

        // 初始化酷狗 API 服务器
        await initKugouServer();
        registerKugouApiIpcHandler();

        // Default open or close DevTools by F12 in development
        // and ignore CommandOrControl + R in production.
        // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
        app.on('browser-window-created', (_, window) => {
            optimizer.watchWindowShortcuts(window)
        })



        // 日志 IPC 处理

        createWindow()

        initAutoUpdater(mainWindow!)
        checkForUpdatesOnStartup()

        // 播放器控制 IPC (先注册 handlers，避免 renderer 在 mpv 初始化前调用失败)
        ipcMain.handle('mpv:load', async (_, url: string) => {
            const controller = getMpvController()
            if (!controller) return { success: false, error: 'mpv not initialized' }
            try {
                await controller.loadFile(url)
                return { success: true }
            } catch (e) {
                return { success: false, error: String(e) }
            }
        })

        ipcMain.handle('mpv:play', async () => {
            const controller = getMpvController()
            if (!controller) return { success: false, error: 'mpv not initialized' }
            try {
                await controller.play()
                return { success: true }
            } catch (e) {
                return { success: false, error: String(e) }
            }
        })

        ipcMain.handle('mpv:pause', async () => {
            const controller = getMpvController()
            if (!controller) return { success: false, error: 'mpv not initialized' }
            try {
                await controller.pause()
                return { success: true }
            } catch (e) {
                return { success: false, error: String(e) }
            }
        })

        ipcMain.handle('mpv:stop', async () => {
            const controller = getMpvController()
            if (!controller) return { success: false, error: 'mpv not initialized' }
            try {
                await controller.stop()
                return { success: true }
            } catch (e) {
                return { success: false, error: String(e) }
            }
        })

        ipcMain.handle('mpv:seek', async (_, time: number) => {
            const controller = getMpvController()
            if (!controller) return { success: false, error: 'mpv not initialized' }
            try {
                await controller.seek(time)
                return { success: true }
            } catch (e) {
                return { success: false, error: String(e) }
            }
        })

        ipcMain.handle('mpv:setVolume', async (_, volume: number) => {
            const controller = getMpvController()
            if (!controller) return { success: false, error: 'mpv not initialized' }
            try {
                await controller.setVolume(volume)
                return { success: true }
            } catch (e) {
                return { success: false, error: String(e) }
            }
        })

        ipcMain.handle('mpv:getState', async () => {
            const controller = getMpvController()
            if (!controller) return null
            return controller.currentState
        })

        // 初始化 mpv 播放器
        await initMpvPlayer(() => mainWindow, () => lyricsWindow)


        app.on('activate', function () {
            // On macOS it's common to re-create a window in the app when the
            // dock icon is clicked and there are no other windows open.
            if (BrowserWindow.getAllWindows().length === 0) createWindow()
        })
    })

    // Quit when all windows are closed, except on macOS. There, it's common
    // for applications and their menu bar to stay active until the user quits
    // explicitly with Cmd + Q.
    app.on('window-all-closed', () => {
        destroyMpvPlayer()

        if (process.platform !== 'darwin') {
            app.quit()
        }
    })
}

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
// 窗口控制
ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
})

ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
        win.unmaximize()
    } else {
        win?.maximize()
    }
})

ipcMain.on('window-close', (event) => {
    // 先关闭歌词窗口
    if (lyricsWindow && !lyricsWindow.isDestroyed()) {
        lyricsWindow.close()
    }
    // 再关闭主窗口
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
})

function createLyricsWindow(): void {
    if (lyricsWindow) {
        lyricsWindow.show()
        return
    }

    // 获取屏幕尺寸
    const { screen } = require('electron')
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: _screenHeight } = primaryDisplay.workAreaSize

    // 桌面歌词默认位置：顶部中间
    const lyricsWidth = 600
    const lyricsHeight = 150
    const lyricsX = Math.floor((screenWidth - lyricsWidth) / 2)
    const lyricsY = 10

    lyricsWindow = new BrowserWindow({
        width: lyricsWidth,
        height: lyricsHeight,
        x: lyricsX,
        y: lyricsY,
        show: false,
        autoHideMenuBar: true,
        ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            allowRunningInsecureContent: true,
            webSecurity: false,
            contextIsolation: true,
            nodeIntegration: false
        },
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
        skipTaskbar: true
    })

    lyricsWindow.on('ready-to-show', () => {
        lyricsWindow?.show()
    })

    lyricsWindow.on('closed', () => {
        lyricsWindow = null
    })

    lyricsWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        lyricsWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/lyrics')
    } else {
        lyricsWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '#/lyrics' })
    }
}

ipcMain.on('lyrics-window:toggle', () => {
    if (lyricsWindow) {
        if (lyricsWindow.isVisible()) {
            lyricsWindow.hide()
        } else {
            lyricsWindow.show()
        }
    } else {
        createLyricsWindow()
    }
})

ipcMain.on('lyrics-window:close', () => {
    lyricsWindow?.close()
})

ipcMain.on('lyrics-window:show', () => {
    lyricsWindow?.show()
})

ipcMain.on('lyrics-window:hide', () => {
    lyricsWindow?.hide()
})

ipcMain.on('lyrics-window:visibility-changed', (_, visible) => {
    mainWindow?.webContents.send('lyrics-window:visibility-changed', visible)
})

ipcMain.on('lyrics-window:setSize', (_, width, height) => {
    lyricsWindow?.setSize(width, height)
})

ipcMain.on('lyrics-window:setPosition', (_, x, y) => {
    lyricsWindow?.setPosition(x, y)
})

ipcMain.on('lyrics-window:ignoreMouse', (_, ignore) => {
    if (lyricsWindow && !lyricsWindow.isDestroyed()) {
        lyricsWindow.setIgnoreMouseEvents(ignore, { forward: true })
    }
})

// 移动主窗口（bounds）
ipcMain.on('main-window:move', (_, x, y, width, height) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setBounds({ x, y, width, height })
    }
})

// 获取主窗口 bounds
ipcMain.handle('main-window:getBounds', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        return mainWindow.getBounds()
    }
    return null
})

// 打开设置弹窗
ipcMain.on('main-window:openSettings', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('main-window:openSettings')
    }
})

// 聚焦主窗口
ipcMain.on('main-window:focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore()
        }
        mainWindow.show()
        mainWindow.focus()
    }
})

// 移动主窗口（bounds）
ipcMain.on('lyrics-window:move', (_, x, y, width, height) => {
    if (lyricsWindow && !lyricsWindow.isDestroyed()) {
        lyricsWindow.setBounds({ x, y, width, height })
    }
})

// 获取歌词窗口 bounds
ipcMain.handle('lyrics-window:getBounds', () => {
    if (lyricsWindow && !lyricsWindow.isDestroyed()) {
        return lyricsWindow.getBounds()
    }
    return null
})

function broadcastToLyricsWindow(eventName: string, ...args: any[]) {
    if (lyricsWindow && !lyricsWindow.isDestroyed()) {
        lyricsWindow.webContents.send(eventName, ...args)
    }
}

ipcMain.on('player:time-update', (_, time) => {
    broadcastToLyricsWindow('player:time-update', time)
})

ipcMain.on('player:duration', (_, duration) => {
    broadcastToLyricsWindow('player:duration', duration)
})

ipcMain.on('player:state', (_, state) => {
    broadcastToLyricsWindow('player:state', state)
})

ipcMain.on('lyrics:update', (_, lyrics) => {
    broadcastToLyricsWindow('lyrics:update', lyrics)
})

ipcMain.on('settings:update', (_, settings) => {
    broadcastToLyricsWindow('settings:update', settings)
})

// 歌词窗口控制播放器
ipcMain.on('player:control', (_, action: string) => {
    mainWindow?.webContents.send('player:control', action)
})

// 歌词窗口播放控制
ipcMain.on('lyrics:playPrev', () => {
    mainWindow?.webContents.send('lyrics:playPrev')
})

ipcMain.on('lyrics:playNext', () => {
    mainWindow?.webContents.send('lyrics:playNext')
})

// 歌词窗口请求数据
ipcMain.on('lyrics-window:request-data', () => {
    mainWindow?.webContents.send('lyrics-window:request-data')
})
