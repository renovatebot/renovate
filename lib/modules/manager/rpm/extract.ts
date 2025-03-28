import { logger } from '../../../logger';
import type { PackageFileContent } from '../types';

export async function extractPackageFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  logger.debug(`rpm.extractPackageFile(${packageFile})`);

  let extension = packageFile.split('.').pop();
  let lockFile = `rpms.lock.${extension}`;

  logger.debug(`RPM lock file: ${lockFile}`);

  return {
    lockFiles: [lockFile],
    deps: [],
  };
}
