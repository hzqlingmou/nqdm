import config from '../config.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Authorization header missing or invalid');
        return res.status(401).json({
            code: 401,
            error: 'Authorization header missing or invalid'
        });
    }

    const token = authHeader.split(' ')[1];

    if (token !== config.API_TOKEN) {
        logger.warn('Invalid API token provided');
        return res.status(401).json({
            code: 401,
            error: 'Invalid API token'
        });
    }

    logger.debug('Request authenticated successfully');
    next();
};