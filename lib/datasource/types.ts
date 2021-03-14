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
}

export interface DatasourceApi {
  id: string;
  getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;
  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null>;
  defaultRegistryUrls?: string[];
  defaultVersioning?: string;
  defaultConfig?: Record<string, unknown>;

  // registryStrategy=first means only the first registryUrl will be tried and others ignored
  // registryStrategy=hunt means registryUrls will be tried in order until one returns a result
  // registryStrategy=merge means all registryUrls will be tried and the results merged if more than one returns a result
  registryStrategy?: 'first' | 'hunt' | 'merge';

  // registryUrlRestriction=fixed means the default registryUrl settings can't be overridden
  // registryUrlRestriction=disallowed means that registryUrls are not applicable to this datasource
  // If registryUrlRestriction is unspecified, it means custom registryUrls are allowed (no retriction)
  registryUrlRestriction?: 'fixed' | 'disallowed';

  // caching=true means caching will be performed by the datasource index instead of the datasource implementation
  caching?: boolean;
}
