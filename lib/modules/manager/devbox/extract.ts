import { logger, withMeta } from '../../../logger';
import type { PackageFileContent } from '../types';
import { Devbox } from './schema';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace('devbox.extractPackageFile()');

  const deps = withMeta({ packageFile }, () => Devbox.parse(content));
  if (!deps.length) {
    return null;
  }

  return { deps };
}
