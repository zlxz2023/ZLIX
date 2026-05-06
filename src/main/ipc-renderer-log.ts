import { ipcMain, shell } from "electron";
import log from "electron-log";
import { rendererLog } from "./logger";

type LogLevel = "info" | "warn" | "error" | "debug";

const initRendererLogIpc = (): void => {
  ipcMain.on("renderer-log", (_event, level: LogLevel, message: string, args: unknown[]) => {
    const logMethod = rendererLog[level];
    if (typeof logMethod === "function") {
      if (args && args.length > 0) {
        logMethod(message, ...args);
      } else {
        logMethod(message);
      }
    }
  });

  ipcMain.on("open-log-file", () => {
    const logFile = log.transports.file.getFile().path;
    shell.showItemInFolder(logFile);
    rendererLog.info("📂 Opened log directory:", logFile);
  });
};

export default initRendererLogIpc;