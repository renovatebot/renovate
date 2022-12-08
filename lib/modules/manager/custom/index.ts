import type { ExtractConfig, PackageFile, Result } from '../types';
import managers from './api';

export function extractPackageFile(
  content: string,
  fileName: string,
  config?: ExtractConfig
): Result<PackageFile | null> {
  const customType = config?.customType ?? 'regex';
  if (!managers.has(customType)) {
    return null;
  }

  const m = managers.get(customType)!;
  return m.extractPackageFile
    ? m.extractPackageFile(content, fileName, config)
    : null;
}
export const defaultConfig = {
  pinDigests: false,
};
export const supportedDatasources = ['*'];
