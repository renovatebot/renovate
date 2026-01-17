import type { Nullish } from '../../../types';

export interface MiseJavaRelease {
  checksum: string | null;
  created_at: string;
  features: string[];
  file_type: string;
  image_type: string;
  java_version: string;
  jvm_impl: string;
  url: string;
  vendor: string;
  version: string;
}

export interface PackageConfig {
  vendor: string;
  imageType: string;
  architecture: Nullish<string>;
  os: Nullish<string>;
  releaseType: string;
}
