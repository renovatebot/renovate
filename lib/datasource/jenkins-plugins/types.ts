import type { Release, ReleaseResult } from '../types';

export type JenkinsCacheTypes = ReleaseResult | Release[];

export interface JenkinsCache<T> {
  name: string;
  dataUrl: string;
  lastSync: Date;
  cacheTimeMin: number;
  cache: Record<string, T>;
  updatePromise?: Promise<void> | undefined;
}

export interface JenkinsPluginInfo {
  name: string;
  scm?: string;
}

export interface JenkinsPluginVersion {
  version: string;
  buildDate?: string;
  url?: string;
}

export interface JenkinsPluginsInfoResponse {
  plugins: Record<string, JenkinsPluginInfo>;
}

export interface JenkinsPluginsVersionsResponse {
  plugins: Record<string, Record<string, JenkinsPluginVersion>>;
}
