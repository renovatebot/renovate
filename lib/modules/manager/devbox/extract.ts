import { logger, withMeta } from '../../../logger/index.ts';
import type { PackageFileContent } from '../types.ts';
import { Devbox } from './schema.ts';

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
