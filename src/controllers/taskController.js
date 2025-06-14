import Task from '../models/Task.js';
import taskManager from '../utils/taskManager.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export const createTask = (req, res) => {
    const { type, params } = req.body;

    if (!type) {
        logger.warn('Task creation failed: type is required');
        return res.status(400).json({ error: 'Task type is required' });
    }

    const task = Task.create(type, params);
    taskManager.addTask(task);

    res.status(202).json({
        taskId: task.id,
        status: task.status,
        message: `Task ${type} submitted`
    });
};

export const getTask = (req, res) => {
    const task = Task.get(req.params.id);

    if (!task) {
        logger.warn(`Task not found: ${req.params.id}`);
        return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
};

export const listTasks = (req, res) => {
    const tasks = Task.getAll();
    res.json(tasks);
};

export const clearTasks = (req, res) => {
    const countBefore = Task.getAll().length;
    Task.clearCompleted();
    const countAfter = Task.getAll().length;
    const cleared = countBefore - countAfter;

    logger.info(`Cleared ${cleared} completed tasks`);
    res.json({
        message: `Cleared ${cleared} completed tasks`,
        remaining: countAfter
    });
};