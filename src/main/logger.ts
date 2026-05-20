import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { app } from "electron";
import { is } from "@electron-toolkit/utils";
import log from "electron-log";

const logDir = is.dev ? join(app.getPath("logs"), "dev") : join(app.getPath("logs"));

if (!existsSync(logDir)) mkdirSync(logDir);

const dateString = new Date().toISOString().slice(0, 10);
const logFilePath = join(logDir, `${dateString}.log`);

log.transports.console.useStyles = true;
log.transports.file.level = "info";
log.transports.file.resolvePathFn = (): string => logFilePath;
log.transports.file.maxSize = 2 * 1024 * 1024;

const autoCleanLog = (daysToKeep: number = 30) => {
  try {
    const files = readdirSync(logDir);
    const now = Date.now();
    const msToKeep = daysToKeep * 24 * 60 * 60 * 1000;

    files.forEach((file) => {
      const filePath = join(logDir, file);
      const stats = statSync(filePath);

      if (now - stats.mtimeMs > msToKeep) {
        unlinkSync(filePath);
        console.log(`已清理旧日志: ${file}`);
      }
    });
  } catch (err) {
    console.error("清理日志失败:", err);
  }
};

autoCleanLog();

const defaultLog = log.scope("default");
console.log = defaultLog.log;
console.info = defaultLog.info;
console.warn = defaultLog.warn;
console.error = defaultLog.error;

export { defaultLog };
export const ipcLog = log.scope("ipc");
export const trayLog = log.scope("tray");
export const thumbarLog = log.scope("thumbar");
export const storeLog = log.scope("store");
export const updateLog = log.scope("update");
export const systemLog = log.scope("system");
export const configLog = log.scope("config");
export const windowsLog = log.scope("windows");
export const processLog = log.scope("process");
export const preloadLog = log.scope("preload");
export const rendererLog = log.scope("renderer");
export const shortcutLog = log.scope("shortcut");
export const serverLog = log.scope("server");
export const cacheLog = log.scope("cache");
export const socketLog = log.scope("socket");
export default log;