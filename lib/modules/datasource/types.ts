import type {
  ConstraintsFilter,
  CustomDatasourceConfig,
} from '../../config/types.ts';
import type { ModuleApi } from '../../types/index.ts';
import type {
  AdditionalConstraintName,
  ConstraintName,
} from '../../util/exec/types.ts';
import type { Timestamp } from '../../util/timestamp.ts';

export interface GetDigestInputConfig {
  datasource: string;
  packageName: string;
  defaultRegistryUrls?: string[];
  registryUrls?: string[] | null;
  registryUrl?: string;
  lookupName?: string;
  additionalRegistryUrls?: string[];
  currentValue?: string;
  currentDigest?: string;
  replacementName?: string;
}

export interface DigestConfig {
  packageName: string;
  lookupName?: string;
  registryUrl?: string;
  currentValue?: string;
  currentDigest?: string;
}

export interface GetReleasesConfig {
  customDatasources?: Record<string, CustomDatasourceConfig>;
  datasource?: string;
  packageName: string;
  registryUrl?: string;
  currentValue?: string;
  constraints?: Partial<Record<ConstraintName, string>>;
  /**
   * Any specific overrides for the versioning for the `AdditionalConstraintName`s.
   */
  constraintsVersioning?: Partial<Record<AdditionalConstraintName, string>>;
  constraintsFiltering?: ConstraintsFilter;
}

export interface GetPkgReleasesConfig {
  customDatasources?: Record<string, CustomDatasourceConfig>;
  npmrc?: string;
  defaultRegistryUrls?: string[];
  registryUrls?: string[] | null;
  additionalRegistryUrls?: string[];
  datasource: string;
  packageName: string;
  currentValue?: string;
  versioning?: string;
  extractVersion?: string;
  versionCompatibility?: string;
  currentCompatibility?: string;
  constraints?: Partial<Record<ConstraintName, string>>;
  replacementName?: string;
  replacementVersion?: string;
  constraintsFiltering?: ConstraintsFilter;
  /**
   * Any specific overrides for the versioning for the `AdditionalConstraintName`s.
   */
  constraintsVersioning?: Partial<Record<AdditionalConstraintName, string>>;
  registryStrategy?: RegistryStrategy;
}

export interface Release {
  changelogContent?: string;
  changelogUrl?: string;
  checksumUrl?: string;
  downloadUrl?: string;
  gitRef?: string;
  isDeprecated?: boolean;
  isStable?: boolean;
  releaseTimestamp?: Timestamp | null;
  version: string;
  /** The original value to which `extractVersion` was applied */
  versionOrig?: string;
  newDigest?: string | null;
  constraints?: Partial<Record<ConstraintName, string[]>>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  registryUrl?: string;
  sourceUrl?: string | undefined;
  sourceDirectory?: string;
  currentAge?: string;
  isLatest?: boolean;
  attestation?: boolean;
}

export interface ReleaseTags {
  /** The latest release, according to the datasource **/
  latest?: string;
  [key: string]: string | undefined;
}

export interface ReleaseResult {
  deprecationMessage?: string;
  isPrivate?: boolean;
  releases: Release[];
  tags?: ReleaseTags | undefined;
  changelogContent?: string;
  // URL metadata
  changelogUrl?: string;
  dependencyUrl?: string;
  homepage?: string | undefined;
  gitRef?: string;
  sourceUrl?: string | null;
  sourceDirectory?: string;
  registryUrl?: string;
  replacementName?: string;
  replacementVersion?: string;
  lookupName?: string;
  packageScope?: string;
  mostRecentTimestamp?: Timestamp;
  isAbandoned?: boolean;
  respectLatest?: boolean;
}

export interface PostprocessReleaseConfig {
  packageName: string;
  registryUrl: string | null;
}

export type PostprocessReleaseResult = Release | 'reject';

export type RegistryStrategy =
  /**
   * Only the first registry URL is queried.
   *
   * If multiple URLs are configured a warning is logged and the rest are ignored. Returns whatever the first registry returns, including `null`.
   */
  | 'first'
  /**
   * Registries are tried in order, returning the first non-null result.
   *
   * `null` results and non-fatal errors (HTTP 401/403/404 and generic errors) are skipped and the next registry is tried.
   * An `ExternalHostError` aborts immediately (unless the cause is `HOST_DISABLED`, which returns `null`).
   *
   * Returns `null` when all registries are exhausted without a result.
   *
   * The default when `registryStrategy` is `undefined`.
   */
  | 'hunt'
  /**
   * All registries are queried.
   *
   * Releases are merged and deduplicated by version; tags are merged with later registries' values taking precedence for duplicate keys.
   *
   * An `ExternalHostError` aborts immediately.
   *
   * Returns `null` when all registries fail.
   */
  | 'merge';
export type SourceUrlSupport = 'package' | 'release' | 'none';
export interface DatasourceApi extends ModuleApi {
  id: string;
  getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;
  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null>;
  defaultRegistryUrls?: string[] | (() => string[]);
  defaultVersioning?: string | undefined;
  defaultConfig?: Record<string, unknown> | undefined;

  /**
   * Strategy to use when multiple registryUrls are available to the datasource.
   *
   * @see RegistryStrategy
   */
  registryStrategy?: RegistryStrategy | undefined;

  /**
   * Whether custom registryUrls are allowed.
   */
  customRegistrySupport: boolean;

  /**
   * Whether release timestamp can be returned.
   */
  releaseTimestampSupport: boolean;
  /**
   * Notes on how release timestamp is determined.
   */
  releaseTimestampNote?: string;

  /**
   * Whether sourceURL can be returned.
   */
  sourceUrlSupport: SourceUrlSupport;
  /**
   * Notes on how sourceURL is determined.
   */
  sourceUrlNote?: string;

  /**
   * Whether to perform centralized caching in the datasource index/wrapper or not.
   *
   * - `true`: datasource index wrapper will cache all results (based on registryUrl/packageName)
   *   - **Must be set only if datasource is able to determine and return `isPrivate` flag**
   * - `false`: centralized caching is not performed, implementation still could do caching internally
   */
  caching?: boolean | undefined;

  /**
   * When the candidate for update is formed, this method could be called
   * to fetch additional information such as `releaseTimestamp`.
   *
   * Also, the release could be checked (and potentially rejected)
   * via some datasource-specific external call.
   *
   * In case of reject, the next candidate release is selected,
   * and `postprocessRelease` is called again.
   *
   * Rejection must happen only when the release will lead to downstream error,
   * e.g. the release turned out to be yanked or doesn't exist for some reason.
   *
   * In other cases, the original `Release` parameter should be returned.
   */
  postprocessRelease(
    config: PostprocessReleaseConfig,
    release: Release,
  ): Promise<PostprocessReleaseResult>;
}
