import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
    createTask,
    getTask,
    listTasks,
    clearTasks
} from '../controllers/taskController.js';

const router = express.Router();

router.use(authenticate);
router.post('/', createTask);
router.get('/:id', getTask);
router.get('/', listTasks);
router.delete('/', clearTasks);

export default router;