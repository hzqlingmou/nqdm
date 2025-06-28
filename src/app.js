import express from 'express';
import morgan from 'morgan';
import http from 'http';
import { WebSocketServer } from 'ws';
import config from './config.js';
import { getLogger, connectWebSocket } from './utils/logger.js';
import taskRoutes from './routes/taskRoutes.js';
import containerRoutes from './routes/containerRoutes.js';
import networkRoutes from './routes/networkRoutes.js';
import fs from 'fs';
import path from 'path';
import process from 'process';

const logger = getLogger();

// 调试模式配置
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const NODE_ENV = process.env.NODE_ENV || 'production';

if (DEBUG_MODE) {
    logger.level = 'debug';
    logger.debug('Debug mode enabled');
    logger.debug(`Node environment: ${NODE_ENV}`);
}

const app = express();
const server = http.createServer(app);

// 创建日志目录
const logDir = path.resolve(config.LOG_DIR);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    logger.info(`Created log directory: ${logDir}`);
}

// 恒定时间比较函数（防止时序攻击）
function timingSafeCompare(a, b) {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    if (bufferA.length !== bufferB.length) {
        return false;
    }

    let result = 0;
    for (let i = 0; i < bufferA.length; i++) {
        result |= bufferA[i] ^ bufferB[i];
    }

    return result === 0;
}


const wss = new WebSocketServer({
    server,
    path: '/ws-logs',
    verifyClient: (info, done) => {
        const authHeader = info.req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('Authorization header missing or invalid');
            done(false, 401, 'Unauthorized');
            return;
        }

        const token = authHeader.split(' ')[1];

        // 使用恒定时间比较防止时序攻击
        const valid = timingSafeCompare(token, config.API_TOKEN);

        if (!valid) {
            logger.warn('Invalid API token provided');
            done(false, 401, 'Unauthorized');
            return;
        }

        logger.debug('WebSocket request authenticated successfully');
        done(true);
    }
});

wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    logger.info(`New WebSocket connection from ${ip}`);

    // 增强心跳检测
    let isAlive = true;

    const heartbeat = () => {
        isAlive = true;
    };

    ws.on('pong', heartbeat);

    // 心跳检测间隔（30秒）
    const heartbeatInterval = setInterval(() => {
        if (!isAlive) {
            logger.warn(`Terminating unresponsive WebSocket connection from ${ip}`);
            return ws.terminate();
        }

        isAlive = false;
        ws.ping();
    }, 30000);

    // 处理连接关闭
    ws.on('close', (code, reason) => {
        clearInterval(heartbeatInterval);
        logger.info(`WebSocket closed [${code}]: ${reason || 'No reason provided'}`);
    });

    // 错误处理
    ws.on('error', (error) => {
        logger.error(`WebSocket error from ${ip}: ${error.message}`, { error });
    });

    // 初始化WebSocket连接
    connectWebSocket(ws);
});

app.use(morgan(DEBUG_MODE ? 'dev' : 'combined', {
    stream: {
        write: (message) => logger.info(message.trim())
    }
}));

app.use(express.json());

// 路由
app.use('/api/tasks', taskRoutes);
app.use('/api/containers', containerRoutes);
app.use('/api/networks', networkRoutes);

// 健康检查
app.get('/health', (req, res) => {
    const serverStatus = {
        status: 'up',
        message: 'Service is healthy',
        debug: DEBUG_MODE,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        websockets: wss.clients.size
    };

    logger.debug('Health check request', serverStatus);
    res.json(serverStatus);
});

// 调试端点 - 仅调试模式可用
if (DEBUG_MODE) {
    app.get('/debug', (req, res) => {
        const debugInfo = {
            timestamp: new Date().toISOString(),
            nodeVersion: process.version,
            platform: process.platform,
            pid: process.pid,
            memory: process.memoryUsage(),
            env: process.env,
            routes: getRegisteredRoutes(app),
            websockets: {
                count: wss.clients.size,
                clients: Array.from(wss.clients).map(client => ({
                    readyState: client.readyState,
                    protocol: client.protocol,
                    ip: client._socket.remoteAddress
                }))
            }
        };

        logger.debug('Debug endpoint accessed');
        res.json(debugInfo);
    });
}

// 获取注册的路由
function getRegisteredRoutes(app) {
    const routes = [];

    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            // 直接挂载的路由
            const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
            routes.push({
                path: middleware.route.path,
                methods: methods
            });
        } else if (middleware.name === 'router') {
            // 路由器实例
            middleware.handle.stack.forEach((handler) => {
                const route = handler.route;
                if (route) {
                    const methods = Object.keys(route.methods).join(', ').toUpperCase();
                    routes.push({
                        path: route.path,
                        methods: methods
                    });
                }
            });
        }
    });

    return routes;
}

// 404处理
app.use('*', (req, res) => {
    logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);

    res.status(404).json({
        code: 404,
        message: 'Path Not Found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        debug: DEBUG_MODE
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);

    const errorResponse = {
        status: 'error',
        message: 'Internal Server Error',
        timestamp: new Date().toISOString(),
        debug: DEBUG_MODE
    };

    if (DEBUG_MODE) {
        errorResponse.error = err.message;
        errorResponse.stack = err.stack;
    }

    res.status(500).json(errorResponse);
});

// 启动服务器
server.listen(config.PORT, () => {
    logger.info(`Server running on port ${config.PORT}`);
    logger.info(`Log level: ${logger.level}`);
    logger.info(`Docker socket: ${config.DOCKER_SOCKET_PATH}`);
    logger.info(`WebSocket authentication token: ${config.API_TOKEN ? '***** (set)' : 'not set'}`);

    if (DEBUG_MODE) {
        logger.debug('Debug mode enabled');
        logger.debug('Registered routes:');

        const routes = getRegisteredRoutes(app);
        routes.forEach(route => {
            logger.debug(`  ${route.methods.padEnd(7)} ${route.path}`);
        });

        logger.debug(`Debug endpoint available at: http://localhost:${config.PORT}/debug`);
    }

    logger.info('Press CTRL+C to stop the server');
});

// 热重载通知
if (DEBUG_MODE) {
    logger.debug('Hot reload is enabled. Server will restart on file changes.');
}

// 优雅关闭处理
process.on('SIGINT', () => {
    logger.info('SIGINT received. Closing server...');

    // 关闭所有WebSocket连接
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.close(1001, 'Server shutting down');
        }
    });

    // 关闭HTTP服务器
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Closing server...');
    server.close(() => {
        process.exit(0);
    });
});