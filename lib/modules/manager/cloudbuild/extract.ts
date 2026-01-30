import { logger } from '../../../logger/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type { PackageFileContent } from '../types.ts';
import { CloudbuildSteps } from './schema.ts';

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
