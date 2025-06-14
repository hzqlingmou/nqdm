import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import {
    listNetworks,
    getNetwork
} from '../controllers/networkController.js';

const router = express.Router();

router.use(authenticate);
router.get('/', listNetworks);
router.get('/:id', getNetwork);

export default router;