import type { OutgoingHttpHeaders } from '../../util/http/types';
import type { Release, ReleaseResult } from '../types';

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
}

export interface NpmResponse {
  _id: string;

  'dist-tags': Record<string, string>;
  name?: string;
  versions?: Record<string, NpmResponseVersion>;
  repository?: {
    url?: string;
    directory?: string;
  };
  homepage?: string;
  time?: Record<string, string>;
}

export interface NpmRelease extends Release {
  gitRef?: string;
}
export interface NpmDependency extends ReleaseResult {
  releases: NpmRelease[];
  deprecationSource?: string;
  name: string;
  homepage: string;
  sourceUrl: string;
  versions: Record<string, any>;
  'dist-tags': Record<string, string>;
  sourceDirectory?: string;
}

export type Npmrc = Record<string, any>;

export interface PackageResolution {
  headers: OutgoingHttpHeaders;
  packageUrl: string;
  registryUrl: string;
}
