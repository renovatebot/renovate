import { logger } from '../../../logger';
import type { PackageFileContent } from '../types';
import { BitriseFile } from './schema';

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const deps = BitriseFile.catch(({ error: err }) => {
    logger.debug({ err, packageFile }, `Failed to parse Bitrise YAML config`);
    return [];
  }).parse(content);

  if (!deps.length) {
    return null;
  }
  return { deps };
}
