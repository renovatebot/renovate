import { logger } from '../../../logger';
import { getDep } from '../dockerfile/extract';
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
  })
    .transform((steps) => steps.map((step) => getDep(step)))
    .parse(content);

  if (!deps.length) {
    return null;
  }

  return { deps };
}
