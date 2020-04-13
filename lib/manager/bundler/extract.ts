import { logger } from '../../logger';
import { PackageFile, PackageDependency } from '../common';
import { platform } from '../../platform';
import { regEx } from '../../util/regex';
import { extractLockFileEntries } from './locked-version';
import * as datasourceRubygems from '../../datasource/rubygems';
import { SkipReason } from '../../types';

export async function extractPackageFile(
  content: string,
  fileName?: string
): Promise<PackageFile | null> {
  const res: PackageFile = {
    registryUrls: [],
    deps: [],
  };
  const lines = content.split('\n');
  const delimiters = ['"', "'"];
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    let sourceMatch: RegExpMatchArray;
    for (const delimiter of delimiters) {
      sourceMatch =
        sourceMatch ||
        regEx(`^source ${delimiter}([^${delimiter}]+)${delimiter}\\s*$`).exec(
          line
        );
    }
    if (sourceMatch) {
      res.registryUrls.push(sourceMatch[1]);
    }
    let rubyMatch: RegExpMatchArray;
    for (const delimiter of delimiters) {
      rubyMatch =
        rubyMatch ||
        regEx(`^ruby ${delimiter}([^${delimiter}]+)${delimiter}`).exec(line);
    }
    if (rubyMatch) {
      res.compatibility = { ruby: rubyMatch[1] };
    }
    let gemMatch: RegExpMatchArray;
    let gemDelimiter: string;
    for (const delimiter of delimiters) {
      const gemMatchRegex = `^gem ${delimiter}([^${delimiter}]+)${delimiter}(,\\s+${delimiter}([^${delimiter}]+)${delimiter}){0,2}`;
      if (regEx(gemMatchRegex).test(line)) {
        gemDelimiter = delimiter;
        gemMatch = gemMatch || regEx(gemMatchRegex).exec(line);
      }
    }
    if (gemMatch) {
      const dep: PackageDependency = {
        depName: gemMatch[1],
        managerData: { lineNumber },
      };
      if (gemMatch[3]) {
        dep.currentValue = gemMatch[0]
          .substring(`gem ${gemDelimiter}${dep.depName}${gemDelimiter},`.length)
          .replace(regEx(gemDelimiter, 'g'), '')
          .trim();
      } else {
        dep.skipReason = SkipReason.NoVersion;
      }
      if (!dep.skipReason) {
        dep.datasource = datasourceRubygems.id;
      }
      res.deps.push(dep);
    }
    const groupMatch = /^group\s+(.*?)\s+do/.exec(line);
    if (groupMatch) {
      const depTypes = groupMatch[1]
        .split(',')
        .map((group) => group.trim())
        .map((group) => group.replace(/^:/, ''));
      const groupLineNumber = lineNumber;
      let groupContent = '';
      let groupLine = '';
      while (lineNumber < lines.length && groupLine !== 'end') {
        lineNumber += 1;
        groupLine = lines[lineNumber];
        if (groupLine !== 'end') {
          groupContent += (groupLine || '').replace(/^ {2}/, '') + '\n';
        }
      }
      const groupRes = await extractPackageFile(groupContent);
      if (groupRes) {
        res.deps = res.deps.concat(
          groupRes.deps.map((dep) => ({
            ...dep,
            depTypes,
            managerData: {
              lineNumber: dep.managerData.lineNumber + groupLineNumber + 1,
            },
          }))
        );
      }
    }
    for (const delimiter of delimiters) {
      const sourceBlockMatch = regEx(
        `^source\\s+${delimiter}(.*?)${delimiter}\\s+do`
      ).exec(line);
      if (sourceBlockMatch) {
        const repositoryUrl = sourceBlockMatch[1];
        const sourceLineNumber = lineNumber;
        let sourceContent = '';
        let sourceLine = '';
        while (lineNumber < lines.length && sourceLine.trim() !== 'end') {
          lineNumber += 1;
          sourceLine = lines[lineNumber];
          // istanbul ignore if
          if (sourceLine === null || sourceLine === undefined) {
            logger.error({ content, fileName }, 'Undefined sourceLine');
            sourceLine = 'end';
          }
          if (sourceLine !== 'end') {
            sourceContent += sourceLine.replace(/^ {2}/, '') + '\n';
          }
        }
        const sourceRes = await extractPackageFile(sourceContent);
        if (sourceRes) {
          res.deps = res.deps.concat(
            sourceRes.deps.map((dep) => ({
              ...dep,
              registryUrls: [repositoryUrl],
              managerData: {
                lineNumber: dep.managerData.lineNumber + sourceLineNumber + 1,
              },
            }))
          );
        }
      }
    }
    const platformsMatch = /^platforms\s+(.*?)\s+do/.test(line);
    if (platformsMatch) {
      const platformsLineNumber = lineNumber;
      let platformsContent = '';
      let platformsLine = '';
      while (lineNumber < lines.length && platformsLine !== 'end') {
        lineNumber += 1;
        platformsLine = lines[lineNumber];
        if (platformsLine !== 'end') {
          platformsContent += platformsLine.replace(/^ {2}/, '') + '\n';
        }
      }
      const platformsRes = await extractPackageFile(platformsContent);
      if (platformsRes) {
        res.deps = res.deps.concat(
          // eslint-disable-next-line no-loop-func
          platformsRes.deps.map((dep) => ({
            ...dep,
            managerData: {
              lineNumber: dep.managerData.lineNumber + platformsLineNumber + 1,
            },
          }))
        );
      }
    }
    const ifMatch = /^if\s+(.*?)/.test(line);
    if (ifMatch) {
      const ifLineNumber = lineNumber;
      let ifContent = '';
      let ifLine = '';
      while (lineNumber < lines.length && ifLine !== 'end') {
        lineNumber += 1;
        ifLine = lines[lineNumber];
        if (ifLine !== 'end') {
          ifContent += ifLine.replace(/^ {2}/, '') + '\n';
        }
      }
      const ifRes = await extractPackageFile(ifContent);
      if (ifRes) {
        res.deps = res.deps.concat(
          // eslint-disable-next-line no-loop-func
          ifRes.deps.map((dep) => ({
            ...dep,
            managerData: {
              lineNumber: dep.managerData.lineNumber + ifLineNumber + 1,
            },
          }))
        );
      }
    }
  }
  if (!res.deps.length && !res.registryUrls.length) {
    return null;
  }

  if (fileName) {
    const gemfileLock = fileName + '.lock';
    const lockContent = await platform.getFile(gemfileLock);
    if (lockContent) {
      logger.debug({ packageFile: fileName }, 'Found Gemfile.lock file');
      const lockedEntries = extractLockFileEntries(lockContent);
      for (const dep of res.deps) {
        const lockedDepValue = lockedEntries.get(dep.depName);
        if (lockedDepValue) {
          dep.lockedVersion = lockedDepValue;
        }
      }
      const bundledWith = /\nBUNDLED WITH\n\s+(.*?)(\n|$)/.exec(lockContent);
      if (bundledWith) {
        res.compatibility = res.compatibility || {};
        res.compatibility.bundler = bundledWith[1];
      }
    }
  }
  return res;
}
