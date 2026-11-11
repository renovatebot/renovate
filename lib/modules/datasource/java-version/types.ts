import type { Nullish } from '../../../types/index.ts';

export type JavaVendor = 'adoptium' | 'oracle-graalvm' | 'graalvm-ce';
export type GraalvmVendor = Exclude<JavaVendor, 'adoptium'>;
export type GraalvmReleaseType = 'ga' | 'ea';

export interface PackageConfig<Vendor extends JavaVendor = JavaVendor> {
  vendor: Vendor;
  imageType: string;
  architecture: Nullish<string>;
  os: Nullish<string>;
  releaseType?: GraalvmReleaseType;
}
