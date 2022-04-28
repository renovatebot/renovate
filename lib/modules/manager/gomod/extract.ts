import semver from 'semver';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { GoDatasource } from '../../datasource/go';
import { isVersion } from '../../versioning/semver';
import type { PackageDependency, PackageFile } from '../types';

function getDep(
  lineNumber: number,
  match: RegExpMatchArray,
  type: string
): PackageDependency {
  const [, , currentValue] = match;
  let [, depName] = match;
  depName = depName.replace(regEx(/"/g), '');
  const dep: PackageDependency = {
    managerData: {
      lineNumber,
    },
    depName,
    depType: type,
    currentValue,
  };
  if (isVersion(currentValue)) {
    dep.datasource = GoDatasource.id;
  } else {
    dep.skipReason = 'unsupported-version';
  }
  const digestMatch = regEx(/v0\.0.0-\d{14}-([a-f0-9]{12})/).exec(currentValue);
  if (digestMatch) {
    [, dep.currentDigest] = digestMatch;
    dep.digestOneAndOnly = true;
  }
  return dep;
}

export function extractPackageFile(content: string): PackageFile | null {
  logger.trace({ content }, 'gomod.extractPackageFile()');
  const constraints: Record<string, any> = {};
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split(newlineRegex);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      let line = lines[lineNumber];
      if (
        line.startsWith('go ') &&
        semver.validRange(line.replace('go ', ''))
      ) {
        constraints.go = line.replace('go ', '^');
      }
      const replaceMatch = regEx(
        /^replace\s+[^\s]+[\s]+[=][>]\s+([^\s]+)\s+([^\s]+)/
      ).exec(line);
      if (replaceMatch) {
        const dep = getDep(lineNumber, replaceMatch, 'replace');
        deps.push(dep);
      }
      const requireMatch = regEx(/^require\s+([^\s]+)\s+([^\s]+)/).exec(line);
      if (requireMatch && !line.endsWith('// indirect')) {
        logger.trace({ lineNumber }, `require line: "${line}"`);
        const dep = getDep(lineNumber, requireMatch, 'require');
        deps.push(dep);
      }
      if (line.trim() === 'require (') {
        logger.trace(`Matched multi-line require on line ${lineNumber}`);
        do {
          lineNumber += 1;
          line = lines[lineNumber];
          const multiMatch = regEx(/^\s+([^\s]+)\s+([^\s]+)/).exec(line);
          logger.trace(`reqLine: "${line}"`);
          if (multiMatch && !line.endsWith('// indirect')) {
            logger.trace({ lineNumber }, `require line: "${line}"`);
            const dep = getDep(lineNumber, multiMatch, 'require');
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            dep.managerData!.multiLine = true;
            deps.push(dep);
          } else if (line.trim() !== ')') {
            logger.debug(`No multi-line match: ${line}`);
          }
        } while (line.trim() !== ')');
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting go modules');
  }
  if (!deps.length) {
    return null;
  }
  return { constraints, deps };
}
