export const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4,
};

export class Logger {
    constructor(name, level = LOG_LEVELS.INFO) {
        this.name = name;
        this.level = level;
    }

    _log(level, ...args) {
        if (level >= this.level) {
            const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
            console.log(`[${new Date().toISOString()}] [${levelName}] [${this.name}]`, ...args);
        }
    }

    debug(...args) {
        this._log(LOG_LEVELS.DEBUG, ...args);
    }

    info(...args) {
        this._log(LOG_LEVELS.INFO, ...args);
    }

    warn(...args) {
        this._log(LOG_LEVELS.WARN, ...args);
    }

    error(...args) {
        this._log(LOG_LEVELS.ERROR, ...args);
    }
}
