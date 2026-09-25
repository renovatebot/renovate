import type {
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from '../types.ts';

export type GoproxyFallback =
  | ',' // WhenNotFoundOrGone
  | '|'; // Always

export interface DataSource {
  datasource: string;
  registryUrl?: string;
  packageName: string;
}

export interface GoproxyItem {
  url: string;
  fallback: GoproxyFallback;
}

/**
 * The part of a `*-tags` datasource which the `go` datasource uses: the tags of
 * the repository a module lives in, and the commit a tag points at.
 */
export interface GoTagsApi {
  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null>;
  getDigest(config: DigestConfig, newValue?: string): Promise<string | null>;
}

/** How the `go` datasource looks up a module hosted on one git host. */
export interface GoTagDatasource {
  readonly api: GoTagsApi;
  /**
   * Browser URL of the repository, for the hosts where it can be derived from
   * the package name. `git-tags` has no such URL, because its package name is
   * already the clone URL of an arbitrary host.
   */
  readonly getSourceUrl?: (packageName: string, registryUrl?: string) => string;
}
