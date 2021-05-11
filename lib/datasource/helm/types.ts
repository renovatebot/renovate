import type { ReleaseResult } from '../types';

export interface HelmRepository {
  entries: Record<
    string,
    {
      home?: string;
      sources?: string[];
      version: string;
      created: string;
    }[]
  >;
}

export type RepositoryData = Record<string, ReleaseResult>;
