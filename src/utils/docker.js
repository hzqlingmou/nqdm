import Docker from 'dockerode';
import { getLogger } from './logger.js';

const logger = getLogger();

class DockerClient {
    constructor() {
        this.docker = new Docker({
            socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock'
        });
        logger.info('Docker client initialized');
    }

    async listContainers(all = true) {
        logger.debug(`Listing containers (all: ${all})`);
        return this.docker.listContainers({ all });
    }

    async createContainer(config) {
        logger.info(`Creating container: ${config.Image} with name: ${config.name}`);
        return this.docker.createContainer(config);
    }

    async getContainer(id) {
        logger.debug(`Getting container: ${id}`);
        return this.docker.getContainer(id);
    }

    async startContainer(id) {
        logger.info(`Starting container: ${id}`);
        const container = this.docker.getContainer(id);
        return container.start();
    }

    async stopContainer(id) {
        logger.info(`Stopping container: ${id}`);
        const container = this.docker.getContainer(id);
        return container.stop();
    }

    async restartContainer(id) {
        logger.info(`Restarting container: ${id}`);
        const container = this.docker.getContainer(id);
        return container.restart();
    }

    async removeContainer(id) {
        logger.info(`Removing container: ${id}`);
        const container = this.docker.getContainer(id);
        return container.remove({ force: true });
    }

    async getContainerLogs(id, tail = 100) {
        logger.debug(`Getting logs for container: ${id} (tail: ${tail})`);
        const container = this.docker.getContainer(id);
        return container.logs({
            stdout: true,
            stderr: true,
            tail,
            timestamps: true
        });
    }

    async getContainerStats(id) {
        logger.debug(`Getting stats for container: ${id}`);
        const container = this.docker.getContainer(id);
        return container.stats({ stream: false });
    }

    async listNetworks() {
        logger.debug('Listing networks');
        return this.docker.listNetworks();
    }

    async createNetwork(config) {
        logger.info(`Creating network: ${config.Name}`);
        return this.docker.createNetwork(config);
    }

    async getNetwork(id) {
        logger.debug(`Getting network: ${id}`);
        return this.docker.getNetwork(id);
    }

    async removeNetwork(id) {
        logger.info(`Removing network: ${id}`);
        const network = this.docker.getNetwork(id);
        return network.remove();
    }

    async connectContainerToNetwork(networkId, containerId, config) {
        logger.info(`Connecting container ${containerId} to network ${networkId}`);
        const network = this.docker.getNetwork(networkId);
        return network.connect({
            Container: containerId,
            EndpointConfig: config
        });
    }

    async disconnectContainerFromNetwork(networkId, containerId) {
        logger.info(`Disconnecting container ${containerId} from network ${networkId}`);
        const network = this.docker.getNetwork(networkId);
        return network.disconnect({
            Container: containerId,
            Force: true
        });
    }
}

export default new DockerClient();