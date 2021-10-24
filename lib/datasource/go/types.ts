import type { GoproxyFallback } from './common';

export interface DataSource {
  datasource: string;
  registryUrl?: string;
  lookupName: string;
}

export interface VersionInfo {
  Version: string;
  Time?: string;
}

export interface GoproxyItem {
  url: 'off' | 'direct' | string;
  fallback: GoproxyFallback;
}
