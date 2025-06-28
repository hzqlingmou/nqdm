import log4js from 'log4js';
import config from '../config.js';
import process from 'process';

const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

// 创建WebSocket广播器
const clients = new Set();

// 配置log4js
log4js.configure({
    appenders: {
        console: {
            type: 'console',
            layout: DEBUG_MODE ? {
                type: 'pattern',
                pattern: '%[%d{hh:mm:ss} %p %c%] %m'
            } : undefined
        },
        file: {
            type: 'file',
            filename: `${config.LOG_DIR}/app.log`,
            maxLogSize: 10485760,
            backups: 5,
            compress: true
        },
        errorFile: {
            type: 'file',
            filename: `${config.LOG_DIR}/errors.log`,
            maxLogSize: 10485760,
            backups: 5,
            compress: true
        },
        combined: {
            type: 'multiFile',
            base: `${config.LOG_DIR}/`,
            property: 'categoryName',
            extension: '.log'
        }
    },
    categories: {
        default: {
            appenders: ['console', 'file', 'combined'],
            level: config.LOG_LEVEL
        },
        error: {
            appenders: ['console', 'errorFile', 'combined'],
            level: 'error'
        }
    }
});

const logger = log4js.getLogger();
const errorLogger = log4js.getLogger('error');

const broadcastLog = (message) => {
    for (const client of clients) {
        if (client.readyState === 1) {
            try {
                client.send(message);
            } catch (e) {
                console.error('WebSocket send error:', e);
            }
        }
    }
};

const originalLog = logger.log;
logger.log = function(level, ...args) {
    originalLog.apply(this, [level, ...args]);
    broadcastLog(`[${level}] ${args.join(' ')}`);
};

export const getLogger = () => logger;
export const getErrorLogger = () => errorLogger;
export const connectWebSocket = (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
};