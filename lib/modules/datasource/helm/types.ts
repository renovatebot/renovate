import type { ReleaseResult } from '../types';

export interface HelmRelease {
  home?: string;
  sources?: string[];
  version: string;
  created: string;
  urls: string[];
}

export interface HelmRepository {
  entries: Record<string, HelmRelease[]>;
}

export type HelmRepositoryData = Record<string, ReleaseResult>;
