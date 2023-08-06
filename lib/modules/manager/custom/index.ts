import type { ExtractConfig, PackageFileContent, Result } from '../types';

// export hollow functions for validation as manager
export const defaultConfig = {};
export const supportedDatasources = ['*'];
export function extractPackageFile(
  content: string,
  packageFile: string,
  config: ExtractConfig
): Result<PackageFileContent | null> {
  return { deps: [] };
}
