import { DATASOURCE_FAILURE } from '../constants/error-messages';

export interface Config {
  datasource?: string;
  depName?: string;
  lookupName?: string;
  registryUrls?: string[];
}

export type DigestConfig = Config;

interface ReleasesConfigBase {
  compatibility?: Record<string, string>;
  npmrc?: string;
  registryUrls?: string[];
}

export interface GetReleasesConfig extends ReleasesConfigBase {
  lookupName: string;
}

export interface GetPkgReleasesConfig extends ReleasesConfigBase {
  datasource: string;
  depName: string;
  lookupName?: string;
  versioning?: string;
}

export function isGetPkgReleasesConfig(
  input: any
): input is GetPkgReleasesConfig {
  return (
    (input as GetPkgReleasesConfig).datasource !== undefined &&
    (input as GetPkgReleasesConfig).depName !== undefined
  );
}

export interface Release {
  changelogUrl?: string;
  gitRef?: string;
  isDeprecated?: boolean;

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
  tags?: string[];
  versions?: any;
}

export interface Datasource {
  id: string;
  getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;
  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null>;
  defaultRegistryUrls?: string[];
  appendRegistryUrls?: string[];
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
