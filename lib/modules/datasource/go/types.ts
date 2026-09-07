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
