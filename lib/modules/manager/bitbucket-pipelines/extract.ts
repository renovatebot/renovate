import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

const pipeRegex = regEx(`^\\s*-\\s?pipe:\\s*'?"?([^\\s'"]+)'?"?\\s*$`);
const dockerImageRegex = regEx(`^\\s*-?\\s?image:\\s*'?"?([^\\s'"]+)'?"?\\s*$`);

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];

  try {
    const lines = content.split(newlineRegex);
    for (const line of lines) {
      const pipeMatch = pipeRegex.exec(line);
      if (pipeMatch) {
        const pipe = pipeMatch[1];
        const [depName, currentValue] = pipe.split(':');

        const dep: PackageDependency = {
          depName,
          currentValue,
          datasource: 'bitbucket-tags',
        };

        logger.trace(
          {
            depName: dep.depName,
            currentValue: dep.currentValue,
          },
          'Bitbucket pipe'
        );
        dep.depType = 'bitbucket-tags';
        deps.push(dep);
      }

      const dockerImageMatch = dockerImageRegex.exec(line);
      if (dockerImageMatch) {
        const currentFrom = dockerImageMatch[1];
        const dep = getDep(currentFrom);

        logger.trace(
          {
            depName: dep.depName,
            currentValue: dep.currentValue,
            currentDigest: dep.currentDigest,
          },
          'Docker image'
        );
        dep.depType = 'docker';
        deps.push(dep);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting Bitbucket Pipes dependencies');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
