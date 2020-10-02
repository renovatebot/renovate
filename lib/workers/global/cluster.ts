import { logger } from '../../logger';
import { RenovateConfig } from './types';

export function initCluster(config: RenovateConfig): RenovateConfig {
  const cluster = config.cluster;
  if (cluster) {
    const repositories = config.repositories;
    const nodeRepositories = [];
    for (
      let index = cluster.nodeIndex;
      index < repositories.length;
      index += cluster.numberOfNodes
    ) {
      nodeRepositories.push(repositories[index]);
    }
    logger.debug(
      { cluster, repositories, nodeRepositories },
      'Filtered repositories for cluster mode.'
    );
    return { ...config, repositories: nodeRepositories };
  }
  return config;
}
