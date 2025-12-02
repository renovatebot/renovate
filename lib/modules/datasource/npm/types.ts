import type { PackageRule } from '../../../config/types';
import type { HostRule } from '../../../types';

export interface NpmrcRules {
  hostRules: HostRule[];
  packageRules: PackageRule[];
}

export interface NpmAttestations {
  url?: string;
}

export interface NpmDistribution {
  attestations?: NpmAttestations;
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
  dist?: NpmDistribution;
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

export type Npmrc = Record<string, any>;
