import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';
import { PackageFile, PackageDependency } from '../common';
import { VERSION_SCHEME_DOCKER } from '../../constants/version-schemes';

export function extractPackageFile(content: string): PackageFile | null {
  logger.debug('github-actions.extractPackageFile()');
  const deps: PackageDependency[] = [];
  let lineNumber = 0;
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
      dep.managerData = { lineNumber };
      dep.versionScheme = VERSION_SCHEME_DOCKER;
      deps.push(dep);
    }
    lineNumber += 1;
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
