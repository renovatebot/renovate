import { logger } from '../../../logger';
import type { ExtractConfig, PackageFile, Result } from '../types';
import managers from './api';

export function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): Result<PackageFile | null> {
  const { customType = 'regex' } = config;
  if (!managers.has(customType)) {
    logger.warn({ customType }, 'Unknown customManagers type');
    return null;
  }

  const m = managers.get(customType)!;
  return m.extractPackageFile(content, fileName, config);
}
export const defaultConfig = {
  pinDigests: false,
};
export const supportedDatasources = ['*'];
