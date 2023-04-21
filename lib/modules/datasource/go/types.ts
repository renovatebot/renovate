import type { GoproxyFallback } from './common';

export interface DataSource {
  datasource: string;
  registryUrl?: string;
  packageName: string;
}

export interface VersionInfo {
  Version: string;
  Time?: string;
}

export interface GoproxyItem {
  url: string;
  fallback: GoproxyFallback;
}
