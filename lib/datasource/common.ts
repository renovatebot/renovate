export interface PkgReleaseConfig {
  compatibility?: Record<string, string>;
  datasource?: string;
  depName?: string;
  digests?: string;
  digestsStrategy?: string;
  gradleWrapperType?: string;
  lookupName?: string;
  lookupType?: string;
  registryUrls?: string[];
  typeStrategy?: string;
  versionScheme?: string;
}

export interface Release {
  gitref?: string;
  isDeprecated?: boolean;
  version: string;
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

// TODO: Proper typing
export type Preset = any;

export interface Datasource {
  getDigest?(config: DigestConfig, newValue?: string): Promise<string>;
  getPreset?(packageName: string, presetName?: string): Promise<Preset>;
  getPkgReleases(config: PkgReleaseConfig): Promise<ReleaseResult>;
}
