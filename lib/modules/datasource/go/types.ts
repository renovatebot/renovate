import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { TagsApi } from '../git-tags/types.ts';

export type GoproxyFallback =
  | ',' // WhenNotFoundOrGone
  | '|'; // Always

export interface DataSource {
  datasource: DatasourceName;
  registryUrl?: string;
  packageName: string;
}

export interface GoproxyItem {
  url: string;
  fallback: GoproxyFallback;
}

/** How the `go` datasource looks up a module hosted on one git host. */
export interface GoTagDatasource {
  readonly api: TagsApi;
  /**
   * Browser URL of the repository, for the hosts where it can be derived from
   * the package name. `git-tags` has no such URL, because its package name is
   * already the clone URL of an arbitrary host.
   */
  readonly getSourceUrl?: (packageName: string, registryUrl?: string) => string;
}
