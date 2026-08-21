import type { Nullish } from '../../../types/index.ts';

export interface PackageConfig {
  vendor: 'adoptium' | 'oracle-graalvm';
  imageType: string;
  architecture: Nullish<string>;
  os: Nullish<string>;
  releaseType?: string;
}
