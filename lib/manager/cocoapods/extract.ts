import { logger } from '../../logger';
import { PackageDependency, PackageFile } from '../common';

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
  const result: ParsedLine = {};
  for (const regex of Object.values(regexMappings)) {
    const match = line.replace(/#.*$/, '').match(regex);
    if (match && match.groups) {
      Object.assign(result, match.groups);
    }
  }

  if (result.spec) {
    const depName = result.subspec
      ? `${result.spec}/${result.subspec}`
      : result.spec;
    const groupName = result.spec;
    if (depName) result.depName = depName;
    if (groupName) result.groupName = groupName;
    delete result.spec;
    delete result.subspec;
  }

  return result;
}

export function gitDep(parsedLine: ParsedLine): PackageDependency | null {
  const { depName, git, tag } = parsedLine;
  if (git && git.startsWith('https://github.com/')) {
    const githubMatch = git.match(
      /https:\/\/github\.com\/(?<account>[^/]+)\/(?<repo>[^/]+)/
    );
    const { account, repo } = (githubMatch && githubMatch.groups) || {};
    if (account && repo) {
      return {
        datasource: 'github',
        depName,
        lookupName: `${account}/${repo.replace(/\.git$/, '')}`,
        lookupType: 'tags',
        currentValue: tag,
      };
    }
  }

  return null; // TODO: gitlab or gitTags datasources?
}

export function extractPackageFile(content: string): PackageFile | null {
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
        skipReason: 'unknown-version',
      };

      if (currentValue) {
        dep = {
          depName,
          groupName,
          datasource: 'cocoapods',
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
            skipReason: 'git-dependency',
          };
        }
      } else if (path) {
        dep = {
          depName,
          groupName,
          skipReason: 'path-dependency',
        };
      }

      deps.push(dep);
    }
  }

  return deps.length ? { deps } : null;
}
