import type { Nullish } from '../../../types/index.ts';

export interface PackageConfig {
  imageType: string;
  architecture: Nullish<string>;
  os: Nullish<string>;
}
