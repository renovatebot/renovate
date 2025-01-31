import { logger } from '../../../logger';
import type { PackageFileContent } from '../types';
import { DevboxFileSchema } from './schema';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  logger.trace('devbox.extractPackageFile()');

  const parsedFile = DevboxFileSchema.safeParse(content);
  if (parsedFile.error) {
    logger.debug(
      { packageFile, error: parsedFile.error },
      'Error parsing devbox.json',
    );
    return null;
  }

  const deps = parsedFile.data.packages;

  if (deps.length) {
    return { deps };
  }

  return null;
}
