import type { DEFAULT_REGISTRY_URL } from './utils';

/**
 * null means a registry was defined, but we couldn't find a valid URL
 */
export type CargoRegistryUrl = string | typeof DEFAULT_REGISTRY_URL | null;
export type CargoRegistries = Record<string, CargoRegistryUrl>;

export interface CargoManagerData {
  nestedVersion?: boolean;
  registryName?: string;
}
