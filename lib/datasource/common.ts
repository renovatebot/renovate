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
  constraints?: Record<string, string[]>;
}

export interface ReleaseResult {
  latestVersion?: string;
  deprecationMessage?: string;
  display?: string;
  group?: string;
  name?: string;
  pkgName?: string;
  releases: Release[];
  tags?: Record<string, string>;
  versions?: any;
  isPrivate?: boolean;
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
  registryStrategy?: 'first' | 'hunt' | 'merge';
  caching?: boolean;
}

// TODO: remove, only for compatibility
export type Datasource = DatasourceApi;
