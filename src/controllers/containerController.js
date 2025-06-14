import docker from '../utils/docker.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export const listContainers = async (req, res) => {
    try {
        const all = req.query.all === 'true';
        const containers = await docker.listContainers(all);
        res.json(containers);
    } catch (error) {
        logger.error(`Error listing containers: ${error.message}`);
        res.status(500).json({
            error: error.message
        });
    }
};

export const getContainer = async (req, res) => {
    try {
        const container = await docker.getContainer(req.params.id);
        const info = await container.inspect();
        res.json(info);
    } catch (error) {
        if (error.statusCode === 404) {
            logger.warn(`Container not found: ${req.params.id}`);
            return res.status(404).json({ error: 'Container not found' });
        }
        logger.error(`Error getting container: ${req.params.id} - ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

export const getContainerLogs = async (req, res) => {
    try {
        const logs = await docker.getContainerLogs(req.params.id, req.query.tail || 100);
        res.set('Content-Type', 'text/plain');
        res.send(logs);
    } catch (error) {
        if (error.statusCode === 404) {
            logger.warn(`Container not found: ${req.params.id}`);
            return res.status(404).json({ error: 'Container not found' });
        }
        logger.error(`Error getting container logs: ${req.params.id} - ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

export const getContainerStats = async (req, res) => {
    try {
        const stats = await docker.getContainerStats(req.params.id);
        res.set('Content-Type', 'application/json');
        stats.pipe(res);
    } catch (error) {
        if (error.statusCode === 404) {
            logger.warn(`Container not found: ${req.params.id}`);
            return res.status(404).json({ error: 'Container not found' });
        }
        logger.error(`Error getting container stats: ${req.params.id} - ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};