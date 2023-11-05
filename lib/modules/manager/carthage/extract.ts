import { logger } from '../../../logger';
import { getSiblingFileName, localPathExists } from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
import { coerceString } from '../../../util/string';
import { CarthageDatasource } from '../../datasource/carthage';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import type { PackageDependency, PackageFileContent } from '../types';
import type { ManagerData, ParsedLine } from './types';

const regexMappings = [
  regEx(
    `^\\s*(?<type>[^\\s]+)\\s+(['"])(?<url>[^'"]+)(['"])\\s*(['"])(?<version>[^'"]+)(['"])\\s*$`
  ),
  regEx(
    `^\\s*(?<type>[^\\s]+)\\s+(['"])(?<url>[^'"]+)(['"])\\s*(?<condition>>=|==|~>)\\s*(?<version>[^\\s]+)\\s*$`
  ),
  regEx(`^\\s*(?<type>[^\\s]+)\\s+(['"])(?<url>[^'"]+)(['"])\\s*$`),
];

export function parseLine(line: string): ParsedLine {
  let result: ParsedLine = {};
  if (!line) {
    return result;
  }
  for (const regex of Object.values(regexMappings)) {
    const match = regex.exec(line.replace(regEx(/#.*$/), ''));
    if (match?.groups) {
      result = { ...result, ...match.groups };
    }
  }

  return result;
}

function parseDepName(url: string | undefined): string {
  const baseName = url?.split('/').pop() ?? '';
  return baseName.replace(regEx(/\.git$/), '').replace(regEx(/\.json$/), '');
}

function gitDep(parsedLine: ParsedLine): PackageDependency | null {
  const { type, url, version, condition } = parsedLine;

  const platformMatch = regEx(
    /[@/](?<platform>github|gitlab)\.com[:/](?<account>[^/]+)\/(?<repo>[^/]+)/
  ).exec(coerceString(url));

  if (type === 'github' && !url?.startsWith('http')) {
    return {
      datasource: GithubTagsDatasource.id,
      depName: parseDepName(url),
      packageName: url,
      currentValue: `${condition} ${version}`,
    };
  } else if (platformMatch?.groups) {
    const { account, repo, platform } = platformMatch.groups;
    if (account && repo) {
      const datasource =
        platform === 'github'
          ? GithubTagsDatasource.id
          : GitlabTagsDatasource.id;
      return {
        datasource,
        depName: parseDepName(url),
        packageName: `${account}/${repo.replace(regEx(/\.git$/), '')}`,
        currentValue: `${condition} ${version}`,
      };
    }
  }

  return {
    datasource: GitTagsDatasource.id,
    depName: parseDepName(url),
    packageName: url,
    currentValue: `${condition} ${version}`,
  };
}

export async function extractPackageFile(
  content: string,
  packageFile: string
): Promise<PackageFileContent | null> {
  logger.trace(`carthage.extractPackageFile(${packageFile})`);
  const deps: PackageDependency[] = [];
  const lines: string[] = content.split(newlineRegex);

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    const parsedLine = parseLine(line);
    const { type, url, version, condition }: ParsedLine = parsedLine;

    if (url) {
      const managerData: ManagerData = { lineNumber };
      let dep: PackageDependency = {
        depName: parseDepName(url),
        skipReason: 'unspecified-version',
      };

      if (url.startsWith('file://') || url.startsWith('/')) {
        dep = {
          depName: parseDepName(url),
          skipReason: 'local-dependency',
        };
      } else if (type === 'github' || type === 'git') {
        if (version && condition) {
          dep = { ...gitDep(parsedLine), managerData };
        } else {
          if (url.startsWith('http') || version) {
            dep = {
              depName: parseDepName(url),
              skipReason: 'git-dependency',
            };
          } else {
            dep = {
              depName: parseDepName(url),
              skipReason: 'unspecified-version',
            };
          }
        }
      } else if (type === 'binary') {
        if (url.startsWith('http')) {
          if (version && condition) {
            dep = {
              depName: parseDepName(url),
              currentValue: `${condition} ${version}`,
              registryUrls: [url],
              datasource: CarthageDatasource.id,
              managerData,
            };
          } else {
            dep = {
              depName: parseDepName(url),
              skipReason: 'unspecified-version',
            };
          }
        } else {
          dep = {
            depName: parseDepName(url),
            skipReason: 'local-dependency',
          };
        }
      }

      deps.push(dep);
    }
  }
  const res: PackageFileContent = { deps };
  const lockFile = getSiblingFileName(packageFile, 'Cartfile.resolved');
  // istanbul ignore if
  if (await localPathExists(lockFile)) {
    res.lockFiles = [lockFile];
  }
  return res;
}
