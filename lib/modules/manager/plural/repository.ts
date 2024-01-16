import { logger } from '../../../logger';
import type { HelmRepository } from './types';

const REPOSITORIES: Map<string, HelmRepository> = new Map<string, HelmRepository>();

function toKey(repository: HelmRepository): string {
  return `${repository.metadata.name}/${repository.metadata.namespace}`;
}

function cacheRepository(repository: HelmRepository): void {
  REPOSITORIES.set(toKey(repository), repository);
}

function cacheRepositories(repositories: Array<HelmRepository>): void {
  logger.debug(`Caching repositories: ${repositories.length}`)
  repositories.forEach(repository => REPOSITORIES.set(toKey(repository), repository))
}

function getRepository(name: string, namespace: string): HelmRepository | undefined {
  return REPOSITORIES.get(`${name}/${namespace}`);
}

export { cacheRepository, cacheRepositories, getRepository };
