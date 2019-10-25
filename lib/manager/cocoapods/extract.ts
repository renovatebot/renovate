import { logger } from '../../logger';
import { PackageDependency, PackageFile } from '../common';

const regexMapping = {
  depName: /^\s*pod\s+(['"])(?<depName>[^'"]+)\1/,
  currentValue: /^\s*pod\s+(['"])(?<depName>[^'"]+)\1\s*,\s*(['"])(?<currentValue>[^'"]+)\3\s*$/,
  git: /,\s*:git\s*=>\s*(['"])(?<git>[^'"]+)\1/,
  tag: /,\s*:tag\s*=>\s*(['"])(?<tag>[^'"]+)\1/,
  path: /,\s*:path\s*=>\s*(['"])(?<path>[^'"]+)\1/,
  source: /^\s*source\s*(['"])(?<source>[^'"]+)\1/,
};

interface ParsedLine {
  depName?: string;
  currentValue?: string;
  git?: string;
  tag?: string;
  path?: string;
  source?: string;
}

export function parseLine(line: string): ParsedLine {
  const result = {};
  for (const [key, regex] of Object.entries(regexMapping)) {
    const match = line.replace(/#.*$/, '').match(regex);
    const value = match && match.groups && match.groups[key];
    if (value) {
      result[key] = value;
    }
  }
  return result;
}

const defaultRegistryUrl = 'https://github.com/CocoaPods/Specs.git';

export function gitDep(parsedLine: ParsedLine): PackageDependency {
  const { depName, git, tag } = parsedLine;
  if (git.startsWith('https://github.com/')) {
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

  return {
    datasource: 'gitTags',
    depName,
    lookupName: git,
    currentValue: tag,
  };
}

export function extractPackageFile(content: string): PackageFile {
  logger.trace('cocoapods.extractPackageFile()');
  const deps: PackageDependency[] = [];
  const lines = content.split('\n');

  const registryUrls = [];
  const registryUrlsSet = new Set<string>();

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    const parsedLine = parseLine(line);
    const { depName, currentValue, git, tag, path, source } = parsedLine;

    if (source) {
      registryUrlsSet.add(source);
    }

    if (depName) {
      const managerData = { lineNumber };
      let dep: PackageDependency = {
        depName,
        skipReason: 'unknown-version',
      };

      if (currentValue) {
        dep = {
          depName,
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
            skipReason: 'git-dependency',
          };
        }
      } else if (path) {
        dep = {
          depName,
          skipReason: 'path-dependency',
        };
      }

      deps.push(dep);
    }
  }

  registryUrlsSet.delete(defaultRegistryUrl);
  registryUrls.push(defaultRegistryUrl);
  if (registryUrlsSet.size > 0) {
    for (const url of registryUrlsSet.values()) {
      registryUrls.push(url);
    }
  }

  return { deps };
}
