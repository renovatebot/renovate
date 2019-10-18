import { logger } from '../../logger';
import { PackageDependency, PackageFile } from '../common';

const regexMapping = {
  depName: /^\s*pod\s+(['"])(?<depName>[^'"]+)\1/,
  currentValue: /^\s*pod\s+(['"])(?<depName>[^'"]+)\1\s*,\s*(['"])(?<currentValue>[^'"]+)\3\s*$/,
  git: /,\s*:git\s*=>\s*(['"])(?<git>[^'"]+)\1/,
  tag: /,\s*:tag\s*=>\s*(['"])(?<tag>[^'"]+)\1/,
  path: /,\s*:path\s*=>\s*(['"])(?<path>[^'"]+)\1/,
};

interface ParsedLine {
  depName?: string;
  currentValue?: string;
  git?: string;
  tag?: string;
  path?: string;
}

function parseLine(line): ParsedLine {
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

export function extractPackageFile(content: string): PackageFile {
  logger.trace('cocoapods.extractPackageFile()');
  const deps: PackageDependency[] = [];
  const lines = content.split('\n');

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    const { depName, currentValue, git, tag, path } = parseLine(line);
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
        };
      } else if (git) {
        if (tag) {
          dep = {
            datasource: 'git-tags',
            depName: git,
            currentValue: tag,
            managerData,
          };
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

  return { deps };
}
