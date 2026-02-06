import type { z } from 'zod';
import { logger } from '../../../logger/index.ts';
import type { PackageFileContent } from '../types.ts';
import { HomeAssistantManifest } from './schema.ts';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const result = HomeAssistantManifest.safeParse(content);

  if (!result.success) {
    const isInvalidJson = result.error.issues.some(
      (i: z.ZodIssue) => i.message === 'Invalid JSON',
    );
    if (isInvalidJson) {
      logger.debug(
        { packageFile, err: result.error },
        'Failed to parse manifest.json',
      );
    } else {
      logger.debug(
        { packageFile, err: result.error },
        'Not a Home Assistant manifest',
      );
    }
    return null;
  }

  const deps = result.data;

  if (!deps || deps.length === 0) {
    return null;
  }

  return { deps };
}
