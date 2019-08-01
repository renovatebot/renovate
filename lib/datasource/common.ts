export interface PkgReleaseConfig {
  compatibility?: Record<string, string>;
  datasource?: string;
  depName?: string;
  depType?: string;
  digests?: string;
  digestsStrategy?: string;
  gradleWrapperType?: string;
  lookupName?: string;
  lookupType?: string;
  npmrc?: string;
  registryUrls?: string[];
  typeStrategy?: string;
  versionScheme?: string;
}

export interface Release {
  changelogUrl?: string;
  gitref?: string;
  isDeprecated?: boolean;

  releaseDate?: string;
  releaseTimestamp?: any;
  version: string;
}

export interface ReleaseResult {
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
  tags?: string[];
  versions?: any;
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
