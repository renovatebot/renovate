import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
import { RubygemsDatasource } from '../../datasource/rubygems';
import type { PackageDependency, PackageFileContent } from '../types';
import { delimiters, extractRubyVersion, getLockFilePath } from './common';
import { extractLockFileEntries } from './locked-version';

function formatContent(input: string): string {
  return input.replace(regEx(/^ {2}/), '') + '\n'; //remove leading whitespace and add a new line at the end
}

export async function extractPackageFile(
  content: string,
  packageFile?: string,
): Promise<PackageFileContent | null> {
  let lineNumber: number;
  async function processGroupBlock(
    line: string,
    repositoryUrl?: string,
    trimGroupLine: boolean = false,
  ): Promise<void> {
    const groupMatch = regEx(/^group\s+(.*?)\s+do/).exec(line);
    if (groupMatch) {
      const depTypes = groupMatch[1]
        .split(',')
        .map((group) => group.trim())
        .map((group) => group.replace(regEx(/^:/), ''));

      const groupLineNumber = lineNumber;
      let groupContent = '';
      let groupLine = '';

      while (
        lineNumber < lines.length &&
        (trimGroupLine ? groupLine.trim() !== 'end' : groupLine !== 'end')
      ) {
        lineNumber += 1;
        groupLine = lines[lineNumber];

        // istanbul ignore if
        if (!is.string(groupLine)) {
          logger.debug(
            { content, packageFile, type: 'groupLine' },
            'Bundler parsing error',
          );
          groupLine = 'end';
        }
        if (trimGroupLine ? groupLine.trim() !== 'end' : groupLine !== 'end') {
          groupContent += formatContent(groupLine);
        }
      }

      const groupRes = await extractPackageFile(groupContent);
      if (groupRes) {
        res.deps = res.deps.concat(
          groupRes.deps.map((dep) => {
            const depObject = {
              ...dep,
              depTypes,
              managerData: {
                lineNumber:
                  Number(dep.managerData?.lineNumber) + groupLineNumber + 1,
              },
            };
            if (repositoryUrl) {
              depObject.registryUrls = [repositoryUrl];
            }
            return depObject;
          }),
        );
      }
    }
  }
  const res: PackageFileContent = {
    registryUrls: [],
    deps: [],
  };

  const variables: Record<string, string> = {};

  const lines = content.split(newlineRegex);
  for (lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    let sourceMatch: RegExpMatchArray | null = null;
    for (const delimiter of delimiters) {
      sourceMatch =
        sourceMatch ??
        regEx(
          `^source ((${delimiter}(?<registryUrl>[^${delimiter}]+)${delimiter})|(?<sourceName>\\w+))\\s*$`,
        ).exec(line);
    }
    if (sourceMatch) {
      if (sourceMatch.groups?.registryUrl) {
        res.registryUrls?.push(sourceMatch.groups.registryUrl);
      }
      if (sourceMatch.groups?.sourceName) {
        const registryUrl = variables[sourceMatch.groups.sourceName];
        if (registryUrl) {
          res.registryUrls?.push(registryUrl);
        }
      }
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

    const variableMatchRegex = regEx(
      `^(?<key>\\w+)\\s*=\\s*['"](?<value>[^'"]+)['"]`,
    );
    const variableMatch = variableMatchRegex.exec(line);
    if (variableMatch) {
      if (variableMatch.groups?.key) {
        variables[variableMatch.groups?.key] = variableMatch.groups?.value;
      }
    }

    const gemGitRefsMatchRegex = regEx(
      `^\\s*gem\\s+(['"])(?<depName>[^'"]+)['"]((\\s*,\\s*git:\\s*['"](?<gitUrl>[^'"]+)['"])|(\\s*,\\s*github:\\s*['"](?<repoName>[^'"]+)['"]))(\\s*,\\s*branch:\\s*['"](?<branchName>[^'"]+)['"])?(\\s*,\\s*ref:\\s*['"](?<refName>[^'"]+)['"])?(\\s*,\\s*tag:\\s*['"](?<tagName>[^'"]+)['"])?`,
    );
    const gemGitRefsMatch = gemGitRefsMatchRegex.exec(line);

    const gemMatchRegex = regEx(
      `^\\s*gem\\s+(['"])(?<depName>[^'"]+)(['"])(\\s*,\\s*(?<currentValue>(['"])[^'"]+['"](\\s*,\\s*['"][^'"]+['"])?))?(\\s*,\\s*source:\\s*(['"](?<registryUrl>[^'"]+)['"]|(?<sourceName>[^'"]+)))?`,
    );
    const gemMatch = gemMatchRegex.exec(line);

    if (gemGitRefsMatch) {
      const dep: PackageDependency = {
        depName: gemGitRefsMatch.groups?.depName,
        managerData: { lineNumber },
      };
      if (gemGitRefsMatch.groups?.gitUrl) {
        const gitUrl = gemGitRefsMatch.groups.gitUrl;
        dep.packageName = gitUrl;

        if (gitUrl.startsWith('https://')) {
          dep.sourceUrl = gitUrl.replace(/\.git$/, '');
        }
      } else if (gemGitRefsMatch.groups?.repoName) {
        dep.packageName = `https://github.com/${gemGitRefsMatch.groups.repoName}`;
        dep.sourceUrl = dep.packageName;
      }
      if (gemGitRefsMatch.groups?.refName) {
        dep.currentDigest = gemGitRefsMatch.groups.refName;
      } else if (gemGitRefsMatch.groups?.branchName) {
        dep.currentValue = gemGitRefsMatch.groups.branchName;
      } else if (gemGitRefsMatch.groups?.tagName) {
        dep.currentValue = gemGitRefsMatch.groups.tagName;
      }
      dep.datasource = GitRefsDatasource.id;
      res.deps.push(dep);
    } else if (gemMatch) {
      const dep: PackageDependency = {
        depName: gemMatch.groups?.depName,
        managerData: { lineNumber },
      };
      if (gemMatch.groups?.currentValue) {
        const currentValue = gemMatch.groups.currentValue;
        dep.currentValue = currentValue;
      }
      dep.datasource = RubygemsDatasource.id;
      res.deps.push(dep);
    }

    await processGroupBlock(line);

    for (const delimiter of delimiters) {
      const sourceBlockMatch = regEx(
        `^source\\s+((${delimiter}(?<registryUrl>[^${delimiter}]+)${delimiter})|(?<sourceName>\\w+))\\s+do`,
      ).exec(line);
      if (sourceBlockMatch) {
        let repositoryUrl = '';
        if (sourceBlockMatch.groups?.registryUrl) {
          repositoryUrl = sourceBlockMatch.groups.registryUrl;
        }
        if (sourceBlockMatch.groups?.sourceName) {
          if (variables[sourceBlockMatch.groups.sourceName]) {
            repositoryUrl = variables[sourceBlockMatch.groups.sourceName];
          }
        }
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
              'Bundler parsing error',
            );
            sourceLine = 'end';
          }

          await processGroupBlock(sourceLine.trim(), repositoryUrl, true);

          if (sourceLine.trim() !== 'end') {
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
            })),
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
            'Bundler parsing error',
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
          })),
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
            'Bundler parsing error',
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
          })),
        );
      }
    }
  }
  if (!res.deps.length && !res.registryUrls?.length) {
    return null;
  }

  if (packageFile) {
    const gemfileLockPath = await getLockFilePath(packageFile);
    const lockContent = await readLocalFile(gemfileLockPath, 'utf8');
    if (lockContent) {
      logger.debug(
        `Found lock file ${gemfileLockPath} for packageFile: ${packageFile}`,
      );
      res.lockFiles = [gemfileLockPath];
      const lockedEntries = extractLockFileEntries(lockContent);
      for (const dep of res.deps) {
        // TODO: types (#22198)
        const lockedDepValue = lockedEntries.get(`${dep.depName!}`);
        if (lockedDepValue) {
          dep.lockedVersion = lockedDepValue;
        }
      }
    }
  }
  return res;
}
