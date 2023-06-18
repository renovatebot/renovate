import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
import { RubyGemsDatasource } from '../../datasource/rubygems';
import type { PackageDependency, PackageFileContent } from '../types';
import { delimiters, extractRubyVersion } from './common';
import { extractLockFileEntries } from './locked-version';

function formatContent(input: string): string {
  return input.replace(regEx(/^ {2}/), '') + '\n'; //remove leading witespace and add a new line at the end
}

export async function extractPackageFile(
  content: string,
  packageFile?: string
): Promise<PackageFileContent | null> {
  const res: PackageFileContent = {
    registryUrls: [],
    deps: [],
  };
  const lines = content.split(newlineRegex);
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    let sourceMatch: RegExpMatchArray | null = null;
    for (const delimiter of delimiters) {
      sourceMatch =
        sourceMatch ??
        regEx(`^source ${delimiter}([^${delimiter}]+)${delimiter}\\s*$`).exec(
          line
        );
    }
    if (sourceMatch) {
      res.registryUrls?.push(sourceMatch[1]);
    }

    const rubyMatch = extractRubyVersion(line);
    if (rubyMatch) {
      res.deps.push({
        depName: 'ruby',
        currentValue: rubyMatch,
        datasource: RubyVersionDatasource.id,
        registryUrls: null,
      });
    }

    const gemMatchRegex = regEx(
      `^\\s*gem\\s+(['"])(?<depName>[^'"]+)(['"])(\\s*,\\s*(?<currentValue>(['"])[^'"]+['"](\\s*,\\s*['"][^'"]+['"])?))?`
    );
    const gemMatch = gemMatchRegex.exec(line);
    if (gemMatch) {
      const dep: PackageDependency = {
        depName: gemMatch.groups?.depName,
        managerData: { lineNumber },
      };
      if (gemMatch.groups?.currentValue) {
        const currentValue = gemMatch.groups.currentValue;
        dep.currentValue = currentValue;
      }
      dep.datasource = RubyGemsDatasource.id;
      res.deps.push(dep);
    }
    const groupMatch = regEx(/^group\s+(.*?)\s+do/).exec(line);
    if (groupMatch) {
      const depTypes = groupMatch[1]
        .split(',')
        .map((group) => group.trim())
        .map((group) => group.replace(regEx(/^:/), ''));
      const groupLineNumber = lineNumber;
      let groupContent = '';
      let groupLine = '';
      while (lineNumber < lines.length && groupLine !== 'end') {
        lineNumber += 1;
        groupLine = lines[lineNumber];
        // istanbul ignore if
        if (!is.string(groupLine)) {
          logger.debug(
            { content, packageFile, type: 'groupLine' },
            'Bundler parsing error'
          );
          groupLine = 'end';
        }
        if (groupLine !== 'end') {
          groupContent += formatContent(groupLine);
        }
      }
      const groupRes = await extractPackageFile(groupContent);
      if (groupRes) {
        res.deps = res.deps.concat(
          groupRes.deps.map((dep) => ({
            ...dep,
            depTypes,
            managerData: {
              lineNumber:
                Number(dep.managerData?.lineNumber) + groupLineNumber + 1,
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
          if (!is.string(sourceLine)) {
            logger.debug(
              { content, packageFile, type: 'sourceLine' },
              'Bundler parsing error'
            );
            sourceLine = 'end';
          }
          if (sourceLine !== 'end') {
            sourceContent += formatContent(sourceLine);
          }
        }
        const sourceRes = await extractPackageFile(sourceContent);
        if (sourceRes) {
          res.deps = res.deps.concat(
            sourceRes.deps.map((dep) => ({
              ...dep,
              registryUrls: [repositoryUrl],
              managerData: {
                lineNumber:
                  Number(dep.managerData?.lineNumber) + sourceLineNumber + 1,
              },
            }))
          );
        }
      }
    }
    const platformsMatch = regEx(/^platforms\s+(.*?)\s+do/).test(line);
    if (platformsMatch) {
      const platformsLineNumber = lineNumber;
      let platformsContent = '';
      let platformsLine = '';
      while (lineNumber < lines.length && platformsLine !== 'end') {
        lineNumber += 1;
        platformsLine = lines[lineNumber];
        // istanbul ignore if
        if (!is.string(platformsLine)) {
          logger.debug(
            { content, packageFile, type: 'platformsLine' },
            'Bundler parsing error'
          );
          platformsLine = 'end';
        }
        if (platformsLine !== 'end') {
          platformsContent += formatContent(platformsLine);
        }
      }
      const platformsRes = await extractPackageFile(platformsContent);
      if (platformsRes) {
        res.deps = res.deps.concat(
          platformsRes.deps.map((dep) => ({
            ...dep,
            managerData: {
              lineNumber:
                Number(dep.managerData?.lineNumber) + platformsLineNumber + 1,
            },
          }))
        );
      }
    }
    const ifMatch = regEx(/^if\s+(.*?)/).test(line);
    if (ifMatch) {
      const ifLineNumber = lineNumber;
      let ifContent = '';
      let ifLine = '';
      while (lineNumber < lines.length && ifLine !== 'end') {
        lineNumber += 1;
        ifLine = lines[lineNumber];
        // istanbul ignore if
        if (!is.string(ifLine)) {
          logger.debug(
            { content, packageFile, type: 'ifLine' },
            'Bundler parsing error'
          );
          ifLine = 'end';
        }
        if (ifLine !== 'end') {
          ifContent += formatContent(ifLine);
        }
      }
      const ifRes = await extractPackageFile(ifContent);
      if (ifRes) {
        res.deps = res.deps.concat(
          ifRes.deps.map((dep) => ({
            ...dep,
            managerData: {
              lineNumber:
                Number(dep.managerData?.lineNumber) + ifLineNumber + 1,
            },
          }))
        );
      }
    }
  }
  if (!res.deps.length && !res.registryUrls?.length) {
    return null;
  }

  if (packageFile) {
    const gemfileLock = `${packageFile}.lock`;
    const lockContent = await readLocalFile(gemfileLock, 'utf8');
    if (lockContent) {
      logger.debug(`Found Gemfile.lock file packageFile: ${packageFile}`);
      res.lockFiles = [gemfileLock];
      const lockedEntries = extractLockFileEntries(lockContent);
      for (const dep of res.deps) {
        // TODO: types (#7154)
        const lockedDepValue = lockedEntries.get(`${dep.depName!}`);
        if (lockedDepValue) {
          dep.lockedVersion = lockedDepValue;
        }
      }
    }
  }
  return res;
}
