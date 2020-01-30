import { logger } from '../../logger';
import { getDep } from '../dockerfile/extract';
import { PackageFile, PackageDependency } from '../common';
import { DEP_TYPE_DOCKER, DEP_TYPE_ORB } from '../../constants/dependency';
import { VERSION_SCHEME_NPM } from '../../constants/version-schemes';
import { DATASOURCE_ORB } from '../../constants/data-binary-source';

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const orbs = line.match(/^\s*orbs:\s*$/);
      if (orbs) {
        logger.trace(`Matched orbs on line ${lineNumber}`);
        let foundOrb: boolean;
        do {
          foundOrb = false;
          const orbLine = lines[lineNumber + 1];
          logger.trace(`orbLine: "${orbLine}"`);
          const orbMatch = orbLine.match(/^\s+([^:]+):\s(.+)$/);
          if (orbMatch) {
            logger.trace('orbMatch');
            foundOrb = true;
            lineNumber += 1;
            const depName = orbMatch[1];
            const [orbName, currentValue] = orbMatch[2].split('@');
            const dep: PackageDependency = {
              depType: DEP_TYPE_ORB,
              depName,
              currentValue,
              managerData: { lineNumber },
              datasource: DATASOURCE_ORB,
              lookupName: orbName,
              commitMessageTopic: '{{{depName}}} orb',
              versionScheme: VERSION_SCHEME_NPM,
              rangeStrategy: 'pin',
            };
            deps.push(dep);
          }
        } while (foundOrb);
      }
      const match = line.match(/^\s*- image:\s*'?"?([^\s'"]+)'?"?\s*$/);
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
        dep.depType = DEP_TYPE_DOCKER;
        dep.managerData = { lineNumber };
        deps.push(dep);
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
