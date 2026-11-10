import type { DockerHubTag } from './schema.ts';

export interface DockerHubCacheData {
  items: Record<number, DockerHubTag>;
  updatedAt: string | null;
}

export interface RegistryRepository {
  registryHost: string;
  dockerRepository: string;
}
