import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { OrbDatasource } from '../../datasource/orb';
import * as npmVersioning from '../../versioning/npm';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split(newlineRegex);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const orbs = regEx(/^\s*orbs:\s*$/).exec(line);
      if (orbs) {
        logger.trace(`Matched orbs on line ${lineNumber}`);
        let foundOrbOrNoop: boolean;
        do {
          foundOrbOrNoop = false;
          const orbLine = lines[lineNumber + 1];
          logger.trace(`orbLine: "${orbLine}"`);
          const yamlNoop = regEx(/^\s*(#|$)/).exec(orbLine);
          if (yamlNoop) {
            logger.debug('orbNoop');
            foundOrbOrNoop = true;
            lineNumber += 1;
            continue;
          }
          const orbMatch = regEx(/^\s+([^:]+):\s(.+)$/).exec(orbLine);
          if (orbMatch) {
            logger.trace('orbMatch');
            foundOrbOrNoop = true;
            lineNumber += 1;
            const depName = orbMatch[1];
            const [orbName, currentValue] = orbMatch[2].split('@');
            const dep: PackageDependency = {
              depType: 'orb',
              depName,
              currentValue,
              datasource: OrbDatasource.id,
              packageName: orbName,
              commitMessageTopic: '{{{depName}}} orb',
              versioning: npmVersioning.id,
            };
            deps.push(dep);
          }
        } while (foundOrbOrNoop);
      }
      const match = regEx(/^\s*-? image:\s*'?"?([^\s'"]+)'?"?\s*$/).exec(line);
      if (match) {
        const currentFrom = match[1];
        const dep = getDep(currentFrom);
        logger.debug(
          {
            depName: dep.depName,
            currentValue: dep.currentValue,
            currentDigest: dep.currentDigest,
          },
          'CircleCI docker image',
        );
        dep.depType = 'docker';
        dep.versioning = 'docker';
        if (
          !dep.depName?.startsWith('ubuntu-') &&
          !dep.depName?.startsWith('windows-server-') &&
          !dep.depName?.startsWith('android-') &&
          dep.depName !== 'android'
        ) {
          deps.push(dep);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err, packageFile }, 'Error extracting circleci images');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
