export type GoproxyFallback =
  | ',' // WhenNotFoundOrGone
  | '|'; // Always

import type { DatasourceName } from '../../../datasource-list.generated.ts';

export interface DataSource {
  datasource: DatasourceName;
  registryUrl?: string;
  packageName: string;
}

export interface GoproxyItem {
  url: string;
  fallback: GoproxyFallback;
}
