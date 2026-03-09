import type { Nullish } from '../../../types/index.ts';

export interface AdoptiumJavaVersion {
  semver: string;
}

export interface AdoptiumJavaResponse {
  versions?: AdoptiumJavaVersion[];
}

export interface PackageConfig {
  imageType: string;
  architecture: Nullish<string>;
  os: Nullish<string>;
}
