import type { PackageRule } from '../../../config/types';
import type { HostRule } from '../../../types';
import type { ReleaseResult } from '../types';

export interface NpmrcRules {
  hostRules: HostRule[];
  packageRules: PackageRule[];
}

export interface NpmResponseVersion {
  repository?: {
    url: string;
    directory: string;
  };
  homepage?: string;
  deprecated?: boolean;
  gitHead?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
}

export interface NpmResponse {
  _id: string;
  name: string;
  versions?: Record<string, NpmResponseVersion>;
  repository?: {
    url?: string;
    directory?: string;
  };
  homepage?: string;
  time?: Record<string, string>;
  'dist-tags'?: Record<string, string>;
}

export interface CachedReleaseResult extends ReleaseResult {
  cacheData?: {
    revision?: number;
    etag: string | undefined;
    softExpireAt: string;
  };
}

export type Npmrc = Record<string, any>;
