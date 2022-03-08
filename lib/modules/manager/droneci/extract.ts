import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split(newlineRegex);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const match = regEx(/^\s* image:\s*'?"?([^\s'"]+)'?"?\s*$/).exec(line);
      if (match) {
        const currentFrom = match[1];
        const dep = getDep(currentFrom);
        logger.debug(
          {
            depName: dep.depName,
            currentValue: dep.currentValue,
            currentDigest: dep.currentDigest,
          },
          'DroneCI docker image'
        );
        dep.depType = 'docker';
        deps.push(dep);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting DroneCI images');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
