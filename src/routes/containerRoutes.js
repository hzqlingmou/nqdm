import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
    listContainers,
    getContainer,
    getContainerLogs,
    getContainerStats
} from '../controllers/containerController.js';

const router = express.Router();

router.use(authenticate);
router.get('/', listContainers);
router.get('/:id', getContainer);
router.get('/:id/logs', getContainerLogs);
router.get('/:id/stats', getContainerStats);

export default router;