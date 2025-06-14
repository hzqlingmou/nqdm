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

// 设置WebSocket服务器
const wss = new WebSocketServer({ server, path: '/ws-logs' });
wss.on('connection', (ws) => {
    connectWebSocket(ws);
    logger.info('New WebSocket client connected');
});

// HTTP请求日志中间件
app.use(morgan(DEBUG_MODE ? 'dev' : 'combined', {
    stream: {
        write: (message) => logger.info(message.trim())
    }
}));

// 解析JSON请求体
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
        environment: NODE_ENV,
        version: process.env.npm_package_version,
        uptime: process.uptime(),
        memory: process.memoryUsage()
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
            routes: getRegisteredRoutes(app)
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

// 处理所有未注册的路由 (404)
app.use('*', (req, res) => {
    logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);

    res.status(404).json({
        status: 'error',
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

server.listen(config.PORT, () => {
    logger.info(`Server running on port ${config.PORT}`);
    logger.info(`Log level: ${logger.level}`);
    logger.info(`Docker socket: ${config.DOCKER_SOCKET_PATH}`);

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