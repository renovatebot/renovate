import type { Nullish } from '../../../types/index.ts';

export type JavaVendor = 'adoptium' | 'oracle-graalvm';
export type GraalvmReleaseType = 'ga' | 'ea';

export interface PackageConfig {
  vendor: JavaVendor;
  imageType: string;
  architecture: Nullish<string>;
  os: Nullish<string>;
  releaseType?: GraalvmReleaseType;
}
