import docker from './docker.js';
import Task from '../models/Task.js';
import config from '../config.js';
import { getLogger, getErrorLogger } from './logger.js';

const logger = getLogger();
const errorLogger = getErrorLogger();

class TaskManager {
    constructor() {
        this.queue = [];
        this.activeTasks = 0;
        this.isProcessing = false;
    }

    addTask(task) {
        this.queue.push(task);
        logger.info(`Task added to queue: ${task.id} (${task.type})`);
        this.processQueue();
    }

    processQueue() {
        if (this.isProcessing) return;

        this.isProcessing = true;

        const processNext = () => {
            if (this.activeTasks >= config.MAX_CONCURRENT_TASKS || this.queue.length === 0) {
                this.isProcessing = false;
                return;
            }

            const task = this.queue.shift();
            this.activeTasks++;

            Task.start(task.id);

            // 执行任务
            this.executeTask(task)
                .then(result => {
                    Task.complete(task.id, result);
                })
                .catch(error => {
                    Task.fail(task.id, error);
                    errorLogger.error(`Task failed: ${task.id} (${task.type})`, error);
                })
                .finally(() => {
                    this.activeTasks--;
                    processNext();
                });

            processNext();
        };

        processNext();
    }

    async executeTask(task) {
        try {
            logger.info(`Executing task: ${task.id} (${task.type})`);

            switch (task.type) {
                case 'create_container':
                    return this.createContainer(task);
                case 'start_container':
                    return this.startContainer(task);
                case 'stop_container':
                    return this.stopContainer(task);
                case 'restart_container':
                    return this.restartContainer(task);
                case 'remove_container':
                    return this.removeContainer(task);
                case 'create_network':
                    return this.createNetwork(task);
                case 'connect_network':
                    return this.connectNetwork(task);
                case 'disconnect_network':
                    return this.disconnectNetwork(task);
                default:
                    throw new Error(`Unknown task type: ${task.type}`);
            }
        } catch (error) {
            throw error;
        }
    }

    async createContainer(task) {
        const { image, name, networks } = task.params;
        const container = await docker.createContainer({
            Image: image,
            name: name || undefined
        });

        // 处理网络连接
        if (networks && networks.length > 0) {
            for (const network of networks) {
                await docker.connectContainerToNetwork(
                    network.networkId,
                    container.id,
                    {
                        Aliases: network.aliases || [],
                        IPAMConfig: {
                            IPv4Address: network.ipv4Address,
                            IPv6Address: network.ipv6Address
                        }
                    }
                );
            }
        }

        logger.info(`Container created: ${container.id}`);
        return { containerId: container.id };
    }

    async startContainer(task) {
        const { containerId } = task.params;
        await docker.startContainer(containerId);
        return { message: `Container ${containerId} started` };
    }

    async stopContainer(task) {
        const { containerId } = task.params;
        await docker.stopContainer(containerId);
        return { message: `Container ${containerId} stopped` };
    }

    async restartContainer(task) {
        const { containerId } = task.params;
        await docker.restartContainer(containerId);
        return { message: `Container ${containerId} restarted` };
    }

    async removeContainer(task) {
        const { containerId } = task.params;
        await docker.removeContainer(containerId);
        return { message: `Container ${containerId} removed` };
    }

    async createNetwork(task) {
        const { name, driver, options, ipam } = task.params;
        const network = await docker.createNetwork({
            Name: name,
            Driver: driver || 'bridge',
            Options: options || {},
            IPAM: ipam || {
                Driver: 'default',
                Config: []
            }
        });
        logger.info(`Network created: ${network.id} (${name})`);
        return { networkId: network.id };
    }

    async connectNetwork(task) {
        const { networkId, containerId, aliases, ipv4Address, ipv6Address } = task.params;
        await docker.connectContainerToNetwork(
            networkId,
            containerId,
            {
                Aliases: aliases || [],
                IPAMConfig: {
                    IPv4Address: ipv4Address,
                    IPv6Address: ipv6Address
                }
            }
        );
        return { message: `Container ${containerId} connected to network ${networkId}` };
    }

    async disconnectNetwork(task) {
        const { networkId, containerId } = task.params;
        await docker.disconnectContainerFromNetwork(networkId, containerId);
        return { message: `Container ${containerId} disconnected from network ${networkId}` };
    }
}

export default new TaskManager();