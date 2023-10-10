import type { DEFAULT_REGISTRY_URL } from './utils';

export interface CargoDep {
  /** Path on disk to the crate sources */
  path?: string;
  /** Git URL for the dependency */
  git?: string;
  /** Semver version */
  version?: string;
  /** Name of a registry whose URL is configured in `.cargo/config.toml` */
  registry?: string;
  /** Name of a package to look up */
  package?: string;
  /** Whether the dependency is inherited from the workspace*/
  workspace?: boolean;
}

export type CargoDeps = Record<string, CargoDep | string>;

export interface CargoSection {
  dependencies?: CargoDeps;
  'dev-dependencies'?: CargoDeps;
  'build-dependencies'?: CargoDeps;
}

export interface CargoManifest extends CargoSection {
  target?: Record<string, CargoSection>;
  workspace?: CargoSection;
}

export interface CargoConfig {
  registries?: Record<string, CargoRegistry>;
  source?: Record<string, CargoSource>;
}

export interface CargoRegistry {
  index?: string;
}

export interface CargoSource {
  'replace-with'?: string;
}

/**
 * null means a registry was defined, but we couldn't find a valid URL
 */
export type CargoRegistryUrl = string | typeof DEFAULT_REGISTRY_URL | null;
export interface CargoRegistries {
  [key: string]: CargoRegistryUrl;
}
