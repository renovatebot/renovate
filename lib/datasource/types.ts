import type { ModuleApi } from '../types';

export interface GetDigestInputConfig {
  datasource?: string;
  lookupName?: string;
  depName: string;
  defaultRegistryUrls?: string[];
  registryUrls?: string[];
  currentValue?: string;
  currentDigest?: string;
}

export interface DigestConfig {
  lookupName: string;
  registryUrl?: string;
  currentValue?: string;
  currentDigest?: string;
}

export interface GetReleasesConfig {
  npmrc?: string;
  lookupName: string;
  registryUrl?: string;
}

export interface GetPkgReleasesConfig {
  npmrc?: string;
  defaultRegistryUrls?: string[];
  registryUrls?: string[];
  datasource: string;
  depName: string;
  lookupName?: string;
  versioning?: string;
  extractVersion?: string;
  constraints?: Record<string, string>;
  replacementName?: string;
  replacementVersion?: string;
}

export interface Release {
  changelogUrl?: string;
  checksumUrl?: string;
  downloadUrl?: string;
  gitRef?: string;
  isDeprecated?: boolean;
  isStable?: boolean;
  releaseTimestamp?: any;
  version: string;
  newDigest?: string;
  constraints?: Record<string, string[]>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  registryUrl?: string;
  sourceUrl?: string;
  sourceDirectory?: string;
}

export interface ReleaseResult {
  deprecationMessage?: string;
  isPrivate?: boolean;
  releases: Release[];
  tags?: Record<string, string>;
  // URL metadata
  changelogUrl?: string;
  dependencyUrl?: string;
  homepage?: string;
  sourceUrl?: string;
  sourceDirectory?: string;
  registryUrl?: string;
  replacementName?: string;
  replacementVersion?: string;
}

export interface DatasourceApi extends ModuleApi {
  id: string;
  getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;
  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null>;
  defaultRegistryUrls?: string[];
  defaultVersioning?: string;
  defaultConfig?: Record<string, unknown>;

  /**
   * Strategy to use when multiple registryUrls are available to the datasource.
   * first: only the first registryUrl will be tried and others ignored
   * hunt: registryUrls will be tried in order until one returns a result
   * merge: all registryUrls will be tried and the results merged if more than one returns a result
   */
  registryStrategy?: 'first' | 'hunt' | 'merge';

  /**
   * Whether custom registryUrls are allowed.
   */
  customRegistrySupport: boolean;

  /**
   * Whether to perform caching in the datasource index/wrapper or not.
   * true: datasoure index wrapper should cache all results (based on registryUrl/lookupName)
   * false: caching is not performed, or performed within the datasource implementation
   */
  caching?: boolean;

  /** optional URLs to add to docs as references */
  urls?: string[];
}
