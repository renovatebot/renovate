import type { Timestamp } from '../../../util/timestamp.ts';
import type { DockerHubTag } from './schema.ts';

export interface DockerHubCacheData {
  items: Record<number, DockerHubTag>;
  updatedAt: string | null;
}

export interface RegistryRepository {
  registryHost: string;
  dockerRepository: string;
}

export interface RegistryTimestampsConfig extends RegistryRepository {
  registryApiUrl?: string;
}

export type RegistryTimestampsFetcher = (
  config: RegistryTimestampsConfig,
) => Promise<Map<string, Timestamp> | null>;
