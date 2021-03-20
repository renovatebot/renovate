export interface Config {
  datasource?: string;
  depName?: string;
  lookupName?: string;
  registryUrls?: string[];
}

export interface DigestConfig extends Config {
  registryUrl?: string;
}

export interface ReleasesConfigBase {
  npmrc?: string;
  registryUrls?: string[];
}

export interface GetReleasesConfig extends ReleasesConfigBase {
  lookupName: string;
  registryUrl?: string;
}

export interface GetPkgReleasesConfig extends ReleasesConfigBase {
  datasource: string;
  depName: string;
  lookupName?: string;
  versioning?: string;
  extractVersion?: string;
  constraints?: Record<string, string>;
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
}

export interface DatasourceApi {
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
}
