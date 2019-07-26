import { logger } from '../../logger';
import { isVersion } from '../../versioning/semver';
import { PackageDependency, PackageFile } from '../common';

function getDep(lineNumber: number, match: RegExpMatchArray, type: string) {
  const [, , currentValue] = match;
  let [, depName] = match;
  depName = depName.replace(/"/g, '');
  const dep: PackageDependency = {
    managerData: {
      lineNumber,
    },
    depName,
    depType: type,
    currentValue,
  };
  if (!isVersion(currentValue)) {
    dep.skipReason = 'unsupported-version';
  } else {
    if (depName.startsWith('gopkg.in/')) {
      const [pkg] = depName.replace('gopkg.in/', '').split('.');
      dep.depNameShort = pkg;
    } else if (depName.startsWith('github.com/')) {
      dep.depNameShort = depName.replace('github.com/', '');
    } else {
      dep.depNameShort = depName;
    }
    dep.datasource = 'go';
  }
  const digestMatch = currentValue.match(/v0\.0.0-\d{14}-([a-f0-9]{12})/);
  if (digestMatch) {
    [, dep.currentDigest] = digestMatch;
    dep.digestOneAndOnly = true;
  }
  return dep;
}

export function extractPackageFile(content: string): PackageFile {
  logger.trace({ content }, 'gomod.extractPackageFile()');
  const deps: PackageDependency[] = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      let line = lines[lineNumber];
      const replaceMatch = line.match(
        /^replace\s+[^\s]+[\s]+[=][>]\s+([^\s]+)\s+([^\s]+)/
      );
      if (replaceMatch) {
        const dep = getDep(lineNumber, replaceMatch, 'replace');
        deps.push(dep);
      }
      const requireMatch = line.match(/^require\s+([^\s]+)\s+([^\s]+)/);
      if (requireMatch) {
        logger.trace({ lineNumber }, `require line: "${line}"`);
        const dep = getDep(lineNumber, requireMatch, 'require');
        deps.push(dep);
      }
      if (line.trim() === 'require (') {
        logger.trace(`Matched multi-line require on line ${lineNumber}`);
        do {
          lineNumber += 1;
          line = lines[lineNumber];
          const multiMatch = line.match(/^\s+([^\s]+)\s+([^\s]+)/);
          logger.trace(`reqLine: "${line}"`);
          if (multiMatch) {
            logger.trace({ lineNumber }, `require line: "${line}"`);
            const dep = getDep(lineNumber, multiMatch, 'require');
            dep.managerData.multiLine = true;
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
  return { deps };
}
