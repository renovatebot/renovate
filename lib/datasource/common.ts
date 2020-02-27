import { DATASOURCE_FAILURE } from '../constants/error-messages';

export interface Config {
  datasource?: string;
  depName?: string;
  lookupName?: string;
  registryUrls?: string[];
}
export interface PkgReleaseConfig extends Config {
  compatibility?: Record<string, string>;
  depType?: string;
  npmrc?: string;
  versioning?: string;
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

export interface Datasource {
  getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;
  getPkgReleases(config: PkgReleaseConfig): Promise<ReleaseResult | null>;
}

export class DatasourceError extends Error {
  err: Error;

  datasource?: string;

  lookupName?: string;

  constructor(err: Error) {
    super(DATASOURCE_FAILURE);
    // Set the prototype explicitly: https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
    Object.setPrototypeOf(this, DatasourceError.prototype);
    this.err = err;
  }
}
