import { logger } from '../../../logger';
import type { PackageFileContent } from '../types';
import { CloudbuildSteps } from './schema';

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  const deps = CloudbuildSteps.catch(({ error: err }) => {
    logger.debug(
      { err, packageFile },
      'Cloud Build: error extracting Docker images from a configuration file.',
    );
    return [];
  }).parse(content);

  if (!deps.length) {
    return null;
  }

  return { deps };
}
