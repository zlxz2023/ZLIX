import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { shell } from 'electron'

interface UpdateStatus {
  status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'
  message?: string
  progress?: number
  version?: string
}

const callbackMap = new WeakMap<(...args: any[]) => void, (...args: any[]) => void>()

const api = {
  log: {
    info: (message: string, ...args: unknown[]) =>
      ipcRenderer.send("renderer-log", "info", message, args),
    warn: (message: string, ...args: unknown[]) =>
      ipcRenderer.send("renderer-log", "warn", message, args),
    error: (message: string, ...args: unknown[]) =>
      ipcRenderer.send("renderer-log", "error", message, args),
    debug: (message: string, ...args: unknown[]) =>
      ipcRenderer.send("renderer-log", "debug", message, args),
  },
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, callback: (...args: any[]) => void) => {
      const wrappedCallback = (_: any, ...args: any[]) => callback(...args)
      callbackMap.set(callback, wrappedCallback)
      ipcRenderer.on(channel, wrappedCallback)
    },
    off: (channel: string, callback: (...args: any[]) => void) => {
      const wrappedCallback = callbackMap.get(callback)
      if (wrappedCallback) {
        ipcRenderer.removeListener(channel, wrappedCallback as any)
        callbackMap.delete(callback)
      }
    },
    removeListener: (channel: string, callback: (...args: any[]) => void) => {
      const wrappedCallback = callbackMap.get(callback)
      if (wrappedCallback) {
        ipcRenderer.removeListener(channel, wrappedCallback as any)
        callbackMap.delete(callback)
      }
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel)
    }
  },
  request: (config: any) => ipcRenderer.invoke('api:request', config),
  clearCache: () => ipcRenderer.invoke('api:cache-clear'),
  mpv: {
    load: (url: string) => ipcRenderer.invoke('mpv:load', url),
    play: () => ipcRenderer.invoke('mpv:play'),
    pause: () => ipcRenderer.invoke('mpv:pause'),
    stop: () => ipcRenderer.invoke('mpv:stop'),
    seek: (time: number) => ipcRenderer.invoke('mpv:seek', time),
    setVolume: (volume: number) => ipcRenderer.invoke('mpv:setVolume', volume),
    getState: () => ipcRenderer.invoke('mpv:getState'),
    on: (event: string, callback: (...args: any[]) => void) => {
      ipcRenderer.on(`mpv:${event}`, (_, ...args) => callback(...args))
    },
    off: (event: string, callback: (...args: any[]) => void) => {
      ipcRenderer.removeListener(`mpv:${event}`, callback)
    }
  },
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    onMaximized: (callback: (maximized: boolean) => void) => {
      ipcRenderer.on('window-maximized', (_, maximized) => callback(maximized))
    }
  },
  mainWindow: {
    move: (x: number, y: number, width: number, height: number) => ipcRenderer.send('main-window:move', x, y, width, height),
    getBounds: () => ipcRenderer.invoke('main-window:getBounds'),
    openSettings: () => ipcRenderer.send('main-window:openSettings'),
    focus: () => ipcRenderer.send('main-window:focus')
  },
  lyricsWindow: {
    toggle: () => ipcRenderer.send('lyrics-window:toggle'),
    close: () => ipcRenderer.send('lyrics-window:close'),
    show: () => ipcRenderer.send('lyrics-window:show'),
    hide: () => ipcRenderer.send('lyrics-window:hide'),
    setSize: (width: number, height: number) => ipcRenderer.send('lyrics-window:setSize', width, height),
    setPosition: (x: number, y: number) => ipcRenderer.send('lyrics-window:setPosition', x, y),
    move: (x: number, y: number, width: number, height: number) => ipcRenderer.send('lyrics-window:move', x, y, width, height),
    getBounds: () => ipcRenderer.invoke('lyrics-window:getBounds'),
    setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('lyrics-window:ignoreMouse', ignore),
    requestData: () => ipcRenderer.send('lyrics-window:request-data'),
    sendTimeUpdate: (time: number) => ipcRenderer.send('player:time-update', time),
    sendDurationUpdate: (duration: number) => ipcRenderer.send('player:duration', duration),
    sendPlayerState: (state: any) => ipcRenderer.send('player:state', state),
    sendLyricsUpdate: (data: any) => ipcRenderer.send('lyrics:update', data),
    sendSettingsUpdate: (settings: any) => ipcRenderer.send('settings:update', settings),
    controlPlayer: (action: string) => ipcRenderer.send('player:control', action),
    onTimeUpdate: (callback: (time: number) => void) => {
      ipcRenderer.on('player:time-update', (_, time) => callback(time))
    },
    onDurationUpdate: (callback: (duration: number) => void) => {
      ipcRenderer.on('player:duration', (_, duration) => callback(duration))
    },
    onPlayerState: (callback: (state: any) => void) => {
      ipcRenderer.on('player:state', (_, state) => callback(state))
    },
    onLyricsUpdate: (callback: (lyrics: any) => void) => {
      ipcRenderer.on('lyrics:update', (_, lyrics) => callback(lyrics))
    },
    onSettingsUpdate: (callback: (settings: any) => void) => {
      ipcRenderer.on('settings:update', (_, settings) => callback(settings))
    }
  },
  autoUpdate: {
    check: () => ipcRenderer.invoke('auto-update:check'),
    download: () => ipcRenderer.invoke('auto-update:download'),
    install: () => ipcRenderer.invoke('auto-update:install'),
    onStatus: (callback: (status: UpdateStatus) => void) => {
      ipcRenderer.on('auto-update:status', (_, status) => callback(status))
    },
    offStatus: () => {
      ipcRenderer.removeAllListeners('auto-update:status')
    }
  },
  shell: {
    openExternal: (url: string) => shell.openExternal(url)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}