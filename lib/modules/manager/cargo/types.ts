import type { PackageManagerMinimumReleaseAgeOptions } from '../../../util/minimum-release-age.ts';
import type { Upgrade } from '../types.ts';
import type { DEFAULT_REGISTRY_URL } from './utils.ts';

/**
 * null means a registry was defined, but we couldn't find a valid URL
 */
export type CargoRegistryUrl = string | typeof DEFAULT_REGISTRY_URL | null;
export type CargoRegistries = Record<string, CargoRegistryUrl>;

export interface CargoManagerData {
  nestedVersion?: boolean;
  registryName?: string;
  /** The `registries.<name>.min-publish-age` values of the cargo config, set on the package file. */
  registryMinPublishAges?: Record<string, string>;
  /** Whether the lock file has packages from git repositories, whose age cargo does not check, set on the package file. */
  lockFileHasGitSources?: boolean;
}

export interface CargoLockFileVersions {
  /** The locked versions of each package by name. */
  versionsByPackage: Map<string, string[]>;
  /** Whether the lock file has packages from git repositories. */
  hasGitSources: boolean;
}

export interface MinPublishAgeEnvOptions extends PackageManagerMinimumReleaseAgeOptions {
  upgrades: Upgrade<CargoManagerData>[];
}

export interface MinPublishAgeEnv {
  env: Record<string, string>;
  /** Why cargo checks a smaller publish age for this update. */
  notice?: string;
}
