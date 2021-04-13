import * as datasourceOrb from '../../datasource/orb';
import { logger } from '../../logger';
import * as npmVersioning from '../../versioning/npm';
import { getDep } from '../dockerfile/extract';
import type { PackageDependency, PackageFile } from '../types';

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const orbs = /^\s*orbs:\s*$/.exec(line);
      if (orbs) {
        logger.trace(`Matched orbs on line ${lineNumber}`);
        let foundOrbOrNoop: boolean;
        do {
          foundOrbOrNoop = false;
          const orbLine = lines[lineNumber + 1];
          logger.trace(`orbLine: "${orbLine}"`);
          const yamlNoop = /^\s*(#|$)/.exec(orbLine);
          if (yamlNoop) {
            logger.debug('orbNoop');
            foundOrbOrNoop = true;
            lineNumber += 1;
            continue; // eslint-disable-line no-continue
          }
          const orbMatch = /^\s+([^:]+):\s(.+)$/.exec(orbLine);
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
              datasource: datasourceOrb.id,
              lookupName: orbName,
              commitMessageTopic: '{{{depName}}} orb',
              versioning: npmVersioning.id,
              rangeStrategy: 'pin',
            };
            deps.push(dep);
          }
        } while (foundOrbOrNoop);
      }
      const match = /^\s*-? image:\s*'?"?([^\s'"]+)'?"?\s*$/.exec(line);
      if (match) {
        const currentFrom = match[1];
        const dep = getDep(currentFrom);
        logger.debug(
          {
            depName: dep.depName,
            currentValue: dep.currentValue,
            currentDigest: dep.currentDigest,
          },
          'CircleCI docker image'
        );
        dep.depType = 'docker';
        dep.versioning = 'docker';
        if (
          !dep.depName?.startsWith('ubuntu-') &&
          !dep.depName?.startsWith('windows-server-')
        ) {
          deps.push(dep);
        }
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting circleci images');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
