interface LoggerAPI {
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
}

declare global {
    interface Window {
        logger: LoggerAPI;
    }
}

const logger: LoggerAPI = {
    info: (message: string, ...args: unknown[]) => {
        window.logger?.info(message, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
        window.logger?.warn(message, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
        window.logger?.error(message, ...args);
    },
    debug: (message: string, ...args: unknown[]) => {
        window.logger?.debug(message, ...args);
    },
};

export { logger };
export default logger;