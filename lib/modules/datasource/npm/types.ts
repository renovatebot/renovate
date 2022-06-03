import type { PackageRule } from '../../../config/types';
import type { HostRule } from '../../../types';
import type { Release, ReleaseResult } from '../types';

export interface NpmrcRules {
  hostRules: HostRule[];
  packageRules: PackageRule[];
}

export type NpmResponseVersion = {
  repository?: {
    url: string;
    directory: string;
  };
  homepage?: string;
  deprecated?: boolean;
  gitHead?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

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

export interface NpmRelease extends Release {
  gitRef?: string;
}
export interface NpmDependency extends ReleaseResult {
  releases: NpmRelease[];
  deprecationSource?: string;
  name: string;
  homepage?: string;
  sourceUrl?: string;
  versions: Record<string, any>;
  'dist-tags'?: Record<string, string>;
  sourceDirectory?: string;
}

export type Npmrc = Record<string, any>;
