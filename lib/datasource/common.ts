export interface PkgReleaseConfig {
  compatibility?: Record<string, string>;
  datasource?: string;
  depName?: string;
  lookupName?: string;
  lookupType?: string;
  registryUrls?: string[];
  versionScheme?: string;
}

export interface Release {
  version: string;
  isDeprecated?: boolean;
}

export interface ReleaseResult {
  changelogUrl?: string;
  dockerRegistry?: string;
  dockerRepository?: string;
  homepage?: string;
  pkgName?: string;
  releases: Release[];
  sourceUrl?: string;
}

export interface DigestConfig {
  lookupName: string;
  registryUrls: string[];
}
export interface Datasource {
  getDigest?(config: DigestConfig, newValue?: string): Promise<string>;
  getPkgReleases(config: PkgReleaseConfig): Promise<ReleaseResult>;
}
