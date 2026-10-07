import type { DatasourceName } from '../../../datasource-list.generated.ts';
import type { GitTagsDatasource } from '../git-tags/index.ts';
import type { PlatformTagsDatasource } from '../git-tags/types.ts';

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

/**
 * How the `go` datasource looks up a module hosted on one git host: the
 * platform's tags datasource, or `git-tags` for any other host, whose package
 * name is already the clone URL and which therefore knows no source URL.
 */
export type GoTagDatasource = PlatformTagsDatasource | GitTagsDatasource;
