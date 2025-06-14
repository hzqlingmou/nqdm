import dotenv from 'dotenv';
dotenv.config();

const config = {
    PORT: process.env.PORT || 8080,
    API_TOKEN: process.env.API_TOKEN || 'your_secure_api_token',
    DOCKER_SOCKET_PATH: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
    MAX_CONCURRENT_TASKS: parseInt(process.env.MAX_CONCURRENT_TASKS) || 5,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_DIR: process.env.LOG_DIR || 'logs'
};

export default config;