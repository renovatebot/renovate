export interface Config {
  datasource?: string;
  depName?: string;
  lookupName?: string;
  registryUrls?: string[];
}

export interface DigestConfig extends Config {
  registryUrl?: string;
}

interface ReleasesConfigBase {
  constraints?: Record<string, string>;
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
}

export function isGetPkgReleasesConfig(
  input: unknown
): input is GetPkgReleasesConfig {
  return (
    (input as GetPkgReleasesConfig).datasource !== undefined &&
    (input as GetPkgReleasesConfig).depName !== undefined
  );
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
}

export interface ReleaseResult {
  sourceDirectory?: string;
  latestVersion?: string;
  changelogUrl?: string;
  dependencyUrl?: string;
  deprecationMessage?: string;
  display?: string;
  dockerRegistry?: string;
  dockerRepository?: string;
  group?: string;
  homepage?: string;
  name?: string;
  pkgName?: string;
  releases: Release[];
  sourceUrl?: string;
  tags?: Record<string, string>;
  versions?: any;
  registryUrl?: string;
}

export interface DatasourceApi {
  id: string;
  getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;
  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null>;
  defaultRegistryUrls?: string[];
  appendRegistryUrls?: string[];
  defaultConfig?: Record<string, unknown>;
  registryStrategy?: 'first' | 'hunt' | 'merge';
}

// TODO: remove, only for compatibility
export type Datasource = DatasourceApi;
