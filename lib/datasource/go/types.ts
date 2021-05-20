export interface DataSource {
  datasource: string;
  registryUrl?: string;
  lookupName: string;
}

export interface VersionInfo {
  Version: string;
  Time?: string;
}

export enum GoproxyFallback {
  WhenNotFoundOrGone = ',',
  Always = '|',
}

export interface GoproxyItem {
  url: string;
  fallback: GoproxyFallback;
}
