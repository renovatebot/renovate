export interface Config {
  datasource?: string;
  depName?: string;
  lookupName?: string;
  registryUrls?: string[];
}
export interface PkgReleaseConfig extends Config {
  compatibility?: Record<string, string>;
  depType?: string;
  lookupType?: string;
  npmrc?: string;
  versionScheme?: string;
}

export type DigestConfig = Config;

export interface Release {
  changelogUrl?: string;
  gitRef?: string;
  isDeprecated?: boolean;

  releaseTimestamp?: any;
  version: string;
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
  tags?: string[];
  versions?: any;
}

// TODO: Proper typing
export type Preset = any;

export interface Datasource {
  getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;
  getPreset?(packageName: string, presetName?: string): Promise<Preset>;
  getPkgReleases(config: PkgReleaseConfig): Promise<ReleaseResult | null>;
}
