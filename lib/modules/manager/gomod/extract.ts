import semver from 'semver';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import { GoDatasource } from '../../datasource/go';
import { GolangVersionDatasource } from '../../datasource/golang-version';
import { isVersion } from '../../versioning/semver';
import type { PackageDependency, PackageFileContent } from '../types';
import type { MultiLineParseResult } from './types';

function getDep(
  lineNumber: number,
  match: RegExpMatchArray,
  type: string,
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
  const digestMatch = regEx(GoDatasource.pversionRegexp).exec(currentValue);
  if (digestMatch?.groups?.digest) {
    dep.currentDigest = digestMatch.groups.digest;
    dep.digestOneAndOnly = true;
  }
  return dep;
}

function getGoDep(lineNumber: number, goVer: string): PackageDependency {
  return {
    managerData: {
      lineNumber,
    },
    depName: 'go',
    depType: 'golang',
    currentValue: goVer,
    datasource: GolangVersionDatasource.id,
    versioning: 'go-mod-directive',
  };
}

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  logger.trace({ content }, 'gomod.extractPackageFile()');
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split(newlineRegex);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const goVer = line.startsWith('go ') ? line.replace('go ', '') : null;
      if (goVer && semver.validRange(goVer)) {
        const dep = getGoDep(lineNumber, goVer);
        deps.push(dep);
      }
      const replaceMatch = regEx(
        /^replace\s+[^\s]+[\s]+[=][>]\s+([^\s]+)\s+([^\s]+)/,
      ).exec(line);
      if (replaceMatch) {
        const dep = getDep(lineNumber, replaceMatch, 'replace');
        deps.push(dep);
      }
      const requireMatch = regEx(/^require\s+([^\s]+)\s+([^\s]+)/).exec(line);
      if (requireMatch) {
        if (line.endsWith('// indirect')) {
          logger.trace({ lineNumber }, `indirect line: "${line}"`);
          const dep = getDep(lineNumber, requireMatch, 'indirect');
          dep.enabled = false;
          deps.push(dep);
        } else {
          logger.trace({ lineNumber }, `require line: "${line}"`);
          const dep = getDep(lineNumber, requireMatch, 'require');
          deps.push(dep);
        }
      }
      if (line.trim() === 'require (') {
        logger.trace(`Matched multi-line require on line ${lineNumber}`);
        const matcher = regEx(/^\s+([^\s]+)\s+([^\s]+)/);
        const { reachedLine, detectedDeps } = parseMultiLine(
          lineNumber,
          lines,
          matcher,
          'require',
        );
        lineNumber = reachedLine;
        deps.push(...detectedDeps);
      } else if (line.trim() === 'replace (') {
        logger.trace(`Matched multi-line replace on line ${lineNumber}`);
        const matcher = regEx(/^\s+[^\s]+[\s]+[=][>]\s+([^\s]+)\s+([^\s]+)/);
        const { reachedLine, detectedDeps } = parseMultiLine(
          lineNumber,
          lines,
          matcher,
          'replace',
        );
        lineNumber = reachedLine;
        deps.push(...detectedDeps);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err, packageFile }, 'Error extracting go modules');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}

function parseMultiLine(
  startingLine: number,
  lines: string[],
  matchRegex: RegExp,
  blockType: 'require' | 'replace',
): MultiLineParseResult {
  const deps: PackageDependency[] = [];
  let lineNumber = startingLine;
  let line = '';
  do {
    lineNumber += 1;
    line = lines[lineNumber];
    const multiMatch = matchRegex.exec(line);
    logger.trace(`${blockType}: "${line}"`);
    if (multiMatch && !line.endsWith('// indirect')) {
      logger.trace({ lineNumber }, `${blockType} line: "${line}"`);
      const dep = getDep(lineNumber, multiMatch, blockType);
      dep.managerData!.multiLine = true;
      deps.push(dep);
    } else if (multiMatch && line.endsWith('// indirect')) {
      logger.trace({ lineNumber }, `${blockType} indirect line: "${line}"`);
      const dep = getDep(lineNumber, multiMatch, 'indirect');
      dep.managerData!.multiLine = true;
      dep.enabled = false;
      deps.push(dep);
    } else if (line.trim() !== ')') {
      logger.trace(`No multi-line match: ${line}`);
    }
  } while (line.trim() !== ')');
  return { reachedLine: lineNumber, detectedDeps: deps };
}
