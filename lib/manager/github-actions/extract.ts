import { logger } from '../../logger';
import * as dockerVersioning from '../../versioning/docker';
import { PackageDependency, PackageFile } from '../common';
import { getDep } from '../dockerfile/extract';

export function extractPackageFile(content: string): PackageFile | null {
  logger.debug('github-actions.extractPackageFile()');
  const deps: PackageDependency[] = [];
  for (const line of content.split('\n')) {
    // old github actions syntax will be deprecated on September 30, 2019
    // after that, the first line can be removed
    const match =
      /^\s+uses = "docker:\/\/([^"]+)"\s*$/.exec(line) ||
      /^\s+uses: docker:\/\/([^"]+)\s*$/.exec(line);
    if (match) {
      const [, currentFrom] = match;
      const dep = getDep(currentFrom);
      logger.debug(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Docker image inside GitHub Actions'
      );
      dep.versioning = dockerVersioning.id;
      deps.push(dep);
    }
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
