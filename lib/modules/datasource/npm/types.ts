import type { PackageRule } from '../../../config/types';
import type { HostRule } from '../../../types';
import type { ReleaseResult } from '../types';

export interface NpmrcRules {
  hostRules: HostRule[];
  packageRules: PackageRule[];
}

export interface CachedReleaseResult extends ReleaseResult {
  cacheData?: {
    revision?: number;
    etag: string | undefined;
    softExpireAt: string;
  };
}

export type Npmrc = Record<string, any>;
