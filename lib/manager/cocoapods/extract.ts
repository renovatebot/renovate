import * as datasourceGithubTags from '../../datasource/github-tags';
import * as datasourcePod from '../../datasource/pod';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { getSiblingFileName, localPathExists } from '../../util/fs';
import type { PackageDependency, PackageFile } from '../types';

const regexMappings = [
  /^\s*pod\s+(['"])(?<spec>[^'"/]+)(\/(?<subspec>[^'"]+))?\1/,
  /^\s*pod\s+(['"])[^'"]+\1\s*,\s*(['"])(?<currentValue>[^'"]+)\2\s*$/,
  /,\s*:git\s*=>\s*(['"])(?<git>[^'"]+)\1/,
  /,\s*:tag\s*=>\s*(['"])(?<tag>[^'"]+)\1/,
  /,\s*:path\s*=>\s*(['"])(?<path>[^'"]+)\1/,
  /^\s*source\s*(['"])(?<source>[^'"]+)\1/,
];

export interface ParsedLine {
  depName?: string;
  groupName?: string;
  spec?: string;
  subspec?: string;
  currentValue?: string;
  git?: string;
  tag?: string;
  path?: string;
  source?: string;
}

export function parseLine(line: string): ParsedLine {
  let result: ParsedLine = {};
  if (!line) {
    return result;
  }
  for (const regex of Object.values(regexMappings)) {
    const match = regex.exec(line.replace(/#.*$/, ''));
    if (match?.groups) {
      result = { ...result, ...match.groups };
    }
  }

  if (result.spec) {
    const depName = result.subspec
      ? `${result.spec}/${result.subspec}`
      : result.spec;
    const groupName = result.spec;
    if (depName) {
      result.depName = depName;
    }
    if (groupName) {
      result.groupName = groupName;
    }
    delete result.spec;
    delete result.subspec;
  }

  return result;
}

export function gitDep(parsedLine: ParsedLine): PackageDependency | null {
  const { depName, git, tag } = parsedLine;
  if (git?.startsWith('https://github.com/')) {
    const githubMatch = /https:\/\/github\.com\/(?<account>[^/]+)\/(?<repo>[^/]+)/.exec(
      git
    );
    const { account, repo } = githubMatch?.groups || {};
    if (account && repo) {
      return {
        datasource: datasourceGithubTags.id,
        depName,
        lookupName: `${account}/${repo.replace(/\.git$/, '')}`,
        currentValue: tag,
      };
    }
  }

  return null;
}

export async function extractPackageFile(
  content: string,
  fileName: string
): Promise<PackageFile | null> {
  logger.trace('cocoapods.extractPackageFile()');
  const deps: PackageDependency[] = [];
  const lines: string[] = content.split('\n');

  const registryUrls: string[] = [];

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    const parsedLine = parseLine(line);
    const {
      depName,
      groupName,
      currentValue,
      git,
      tag,
      path,
      source,
    }: ParsedLine = parsedLine;

    if (source) {
      registryUrls.push(source.replace(/\/*$/, ''));
    }

    if (depName) {
      const managerData = { lineNumber };
      let dep: PackageDependency = {
        depName,
        groupName,
        skipReason: SkipReason.UnknownVersion,
      };

      if (currentValue) {
        dep = {
          depName,
          groupName,
          datasource: datasourcePod.id,
          currentValue,
          managerData,
          registryUrls,
        };
      } else if (git) {
        if (tag) {
          dep = { ...gitDep(parsedLine), managerData };
        } else {
          dep = {
            depName,
            groupName,
            skipReason: SkipReason.GitDependency,
          };
        }
      } else if (path) {
        dep = {
          depName,
          groupName,
          skipReason: SkipReason.PathDependency,
        };
      }

      deps.push(dep);
    }
  }
  const res: PackageFile = { deps };
  const lockFile = getSiblingFileName(fileName, 'Podfile.lock');
  // istanbul ignore if
  if (await localPathExists(lockFile)) {
    res.lockFiles = [lockFile];
  }
  return res;
}
