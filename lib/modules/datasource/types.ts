import type {
  ConstraintsFilter,
  CustomDatasourceConfig,
} from '../../config/types';
import type { ModuleApi } from '../../types';

export interface GetDigestInputConfig {
  datasource: string;
  packageName: string;
  defaultRegistryUrls?: string[];
  registryUrls?: string[] | null;
  registryUrl?: string;
  lookupName?: string;
  additionalRegistryUrls?: string[];
  currentValue?: string;
  currentDigest?: string;
  replacementName?: string;
}

export interface DigestConfig {
  packageName: string;
  lookupName?: string;
  registryUrl?: string;
  currentValue?: string;
  currentDigest?: string;
}

export interface GetReleasesConfig {
  customDatasources?: Record<string, CustomDatasourceConfig>;
  datasource?: string;
  packageName: string;
  registryUrl?: string;
  currentValue?: string;
}

export interface GetPkgReleasesConfig {
  customDatasources?: Record<string, CustomDatasourceConfig>;
  npmrc?: string;
  defaultRegistryUrls?: string[];
  registryUrls?: string[] | null;
  additionalRegistryUrls?: string[];
  datasource: string;
  packageName: string;
  currentValue?: string;
  versioning?: string;
  extractVersion?: string;
  versionCompatibility?: string;
  currentCompatibility?: string;
  constraints?: Record<string, string>;
  replacementName?: string;
  replacementVersion?: string;
  constraintsFiltering?: ConstraintsFilter;
}

export interface Release {
  changelogUrl?: string;
  checksumUrl?: string;
  downloadUrl?: string;
  gitRef?: string;
  isDeprecated?: boolean;
  isStable?: boolean;
  releaseTimestamp?: string | null;
  version: string;
  newDigest?: string | undefined;
  constraints?: Record<string, string[]>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  registryUrl?: string;
  sourceUrl?: string | undefined;
  sourceDirectory?: string;
  currentAge?: string;
}

export interface ReleaseResult {
  deprecationMessage?: string;
  isPrivate?: boolean;
  releases: Release[];
  tags?: Record<string, string> | undefined;
  // URL metadata
  changelogUrl?: string;
  dependencyUrl?: string;
  homepage?: string | undefined;
  gitRef?: string;
  sourceUrl?: string | null;
  sourceDirectory?: string;
  registryUrl?: string;
  replacementName?: string;
  replacementVersion?: string;
  lookupName?: string;
  packageScope?: string;
}

export type RegistryStrategy = 'first' | 'hunt' | 'merge';

export interface DatasourceApi extends ModuleApi {
  id: string;
  getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;
  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null>;
  defaultRegistryUrls?: string[] | (() => string[]);
  defaultVersioning?: string | undefined;
  defaultConfig?: Record<string, unknown> | undefined;

  /**
   * Strategy to use when multiple registryUrls are available to the datasource.
   * first: only the first registryUrl will be tried and others ignored
   * hunt: registryUrls will be tried in order until one returns a result
   * merge: all registryUrls will be tried and the results merged if more than one returns a result
   */
  registryStrategy?: RegistryStrategy | undefined;

  /**
   * Whether custom registryUrls are allowed.
   */
  customRegistrySupport: boolean;

  /**
   * Whether to perform caching in the datasource index/wrapper or not.
   * true: datasoure index wrapper should cache all results (based on registryUrl/packageName)
   * false: caching is not performed, or performed within the datasource implementation
   */
  caching?: boolean | undefined;
}
