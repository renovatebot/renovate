import { logger } from '../../../logger';
import type { PackageFileContent } from '../types';
import { DevboxSchema } from './schema';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace('devbox.extractPackageFile()');

  const deps = DevboxSchema.parse(content);
  if (!deps?.length) {
    return null;
  }

  return { deps };
}
