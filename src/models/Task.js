import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

// 存储任务状态
const tasks = {};

class Task {
    static create(type, params) {
        const id = uuidv4();
        const task = {
            id,
            type,
            params,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
            result: null,
            error: null
        };

        tasks[id] = task;
        logger.info(`Task created: ${id} (${type})`);
        return task;
    }

    static start(id) {
        if (tasks[id]) {
            tasks[id].status = 'processing';
            tasks[id].updatedAt = new Date();
            logger.info(`Task started: ${id}`);
            return true;
        }
        logger.warn(`Task not found for start: ${id}`);
        return false;
    }

    static complete(id, result) {
        if (tasks[id]) {
            tasks[id].status = 'completed';
            tasks[id].result = result;
            tasks[id].updatedAt = new Date();
            logger.info(`Task completed: ${id}`);
            return true;
        }
        logger.warn(`Task not found for complete: ${id}`);
        return false;
    }

    static fail(id, error) {
        if (tasks[id]) {
            tasks[id].status = 'failed';
            tasks[id].error = error.message || error;
            tasks[id].updatedAt = new Date();
            logger.error(`Task failed: ${id} - ${error.message || error}`);
            return true;
        }
        logger.warn(`Task not found for: ${id}`);
        return false;
    }

    static get(id) {
        return tasks[id];
    }

    static getAll() {
        return Object.values(tasks);
    }

    static clearCompleted() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        Object.keys(tasks).forEach(id => {
            const task = tasks[id];
            if (task.status === 'completed' && task.updatedAt < oneHourAgo) {
                delete tasks[id];
                logger.debug(`Cleared completed task: ${id}`);
            }
        });
    }
}

// 每分钟清理一次已完成的任务
setInterval(() => {
    Task.clearCompleted();
}, 60 * 1000);

export default Task;