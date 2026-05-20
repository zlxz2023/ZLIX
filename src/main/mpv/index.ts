import type { BrowserWindow } from 'electron';
import { MpvController } from './controller';

let mpvController: MpvController | null = null;
let cachedGetMainWindow: (() => BrowserWindow | null) | null = null;
let cachedGetLyricsWindow: (() => BrowserWindow | null) | null = null;

/** 绑定事件转发到渲染进程 */
function bindEventForwarding(
  controller: MpvController,
  getMainWindow: () => BrowserWindow | null,
  getLyricsWindow: () => BrowserWindow | null,
): void {
  controller.on('time-update', (time: number) => {
    getMainWindow()?.webContents.send('mpv:time-update', time);
    getLyricsWindow()?.webContents.send('mpv:time-update', time);
  });
  controller.on('duration-change', (duration: number) => {
    getMainWindow()?.webContents.send('mpv:duration-change', duration);
    getLyricsWindow()?.webContents.send('mpv:duration-change', duration);
  });
  controller.on('state-change', (state: unknown) => {
    getMainWindow()?.webContents.send('mpv:state-change', state);
    getLyricsWindow()?.webContents.send('mpv:state-change', state);
  });
  controller.on('playback-end', (reason: string) => {
    getMainWindow()?.webContents.send('mpv:playback-end', reason);
    getLyricsWindow()?.webContents.send('mpv:playback-end', reason);
  });
  controller.on('error', (error: Error) => {
    getMainWindow()?.webContents.send('mpv:error', error.message);
    getLyricsWindow()?.webContents.send('mpv:error', error.message);
  });
}

export async function initMpvPlayer(
  getMainWindow: () => BrowserWindow | null,
  getLyricsWindow?: () => BrowserWindow | null,
): Promise<MpvController | null> {
  cachedGetMainWindow = getMainWindow;
  cachedGetLyricsWindow = getLyricsWindow || (() => null);
  const controller = new MpvController();

  if (!controller.available) {
    console.warn('[Main] mpv binary not found, player engine unavailable');
    return null;
  }

  console.log('[Main] mpv controller ready, registering event forwarding');
  bindEventForwarding(controller, getMainWindow, cachedGetLyricsWindow);

  try {
    await controller.start();
    console.log('[Main] mpv player engine started successfully');
    mpvController = controller;
    return controller;
  } catch (err) {
    console.error('[Main] mpv player engine failed to start:', err);
    return null;
  }
}

/** 销毁旧实例并重新初始化 mpv，供 Loading 页面重试使用 */
export async function restartMpvPlayer(): Promise<MpvController | null> {
  console.log('[Main] Restarting mpv player engine');
  destroyMpvPlayer();
  if (!cachedGetMainWindow) {
    console.error('[Main] Cannot restart mpv: getMainWindow not initialized');
    return null;
  }
  return initMpvPlayer(cachedGetMainWindow);
}

export function destroyMpvPlayer(): void {
  mpvController?.destroy();
  mpvController = null;
}

export function getMpvController(): MpvController | null {
  return mpvController;
}