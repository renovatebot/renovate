import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];

  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];

      const pipeMatch = /^\s* - pipe:\s*'?"?([^\s'"]+)'?"?\s*$/.exec(line);
      if (pipeMatch) {
        const pipe = pipeMatch[1];
        const pipeSplit = pipe.split(':');
        const depName = pipeSplit[0].trim();
        const currentValue = pipeSplit[1].trim();

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

      const dockerImageMatch = /^\s*-?\s?image:\s*'?"?([^\s'"]+)'?"?\s*$/.exec(
        line
      );
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
