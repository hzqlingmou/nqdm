import docker from '../utils/docker.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export const listNetworks = async (req, res) => {
    try {
        const networks = await docker.listNetworks();
        res.json(networks);
    } catch (error) {
        logger.error(`Error listing networks: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};

export const getNetwork = async (req, res) => {
    try {
        const network = await docker.getNetwork(req.params.id);
        const info = await network.inspect();
        res.json(info);
    } catch (error) {
        if (error.statusCode === 404) {
            logger.warn(`Network not found: ${req.params.id}`);
            return res.status(404).json({ error: 'Network not found' });
        }
        logger.error(`Error getting network: ${req.params.id} - ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};