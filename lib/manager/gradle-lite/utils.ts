import upath from 'upath';
import { regEx } from '../../util/regex';
import type { PackageDependency } from '../types';
import {
  ManagerData,
  PackageVariables,
  Token,
  TokenType,
  VariableRegistry,
} from './common';

const artifactRegex = regEx(
  '^[a-zA-Z][-_a-zA-Z0-9]*(?:\\.[a-zA-Z0-9][-_a-zA-Z0-9]*?)*$'
);

const versionLikeRegex = regEx('^(?<version>[-.\\[\\](),a-zA-Z0-9+]+)');

// Extracts version-like and range-like strings
// from the beginning of input
export function versionLikeSubstring(input: string): string | null {
  const match = input ? versionLikeRegex.exec(input) : null;
  return match ? match.groups.version : null;
}

export function isDependencyString(input: string): boolean {
  const split = input?.split(':');
  if (split?.length !== 3) {
    return false;
  }
  const [groupId, artifactId, versionPart] = split;
  return (
    groupId &&
    artifactId &&
    versionPart &&
    artifactRegex.test(groupId) &&
    artifactRegex.test(artifactId) &&
    versionPart === versionLikeSubstring(versionPart)
  );
}

export function parseDependencyString(
  input: string
): PackageDependency<ManagerData> | null {
  if (!isDependencyString(input)) {
    return null;
  }
  const [groupId, artifactId, currentValue] = input?.split(':');
  return {
    depName: `${groupId}:${artifactId}`,
    currentValue,
  };
}

export function interpolateString(
  childTokens: Token[],
  variables: PackageVariables
): string | null {
  const resolvedSubstrings = [];
  for (const childToken of childTokens) {
    const type = childToken.type;
    if (type === TokenType.String) {
      resolvedSubstrings.push(childToken.value);
    } else if (type === TokenType.Variable) {
      const varName = childToken.value;
      const varData = variables[varName];
      if (varData) {
        resolvedSubstrings.push(varData.value);
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
  return resolvedSubstrings.join('');
}

export function isGradleFile(path: string): boolean {
  const filename = upath.basename(path).toLowerCase();
  return filename.endsWith('.gradle') || filename.endsWith('.gradle.kts');
}

export function isPropsFile(path: string): boolean {
  const filename = upath.basename(path).toLowerCase();
  return filename === 'gradle.properties';
}

export function toAbsolutePath(packageFile: string): string {
  return upath.join(packageFile.replace(/^[/\\]*/, '/'));
}

export function reorderFiles(packageFiles: string[]): string[] {
  return packageFiles.sort((x, y) => {
    const xAbs = toAbsolutePath(x);
    const yAbs = toAbsolutePath(y);

    const xDir = upath.dirname(xAbs);
    const yDir = upath.dirname(yAbs);

    if (xDir === yDir) {
      if (
        (isGradleFile(xAbs) && isGradleFile(yAbs)) ||
        (isPropsFile(xAbs) && isPropsFile(yAbs))
      ) {
        if (xAbs > yAbs) {
          return 1;
        }
        if (xAbs < yAbs) {
          return -1;
        }
      } else if (isGradleFile(xAbs)) {
        return 1;
      } else if (isGradleFile(yAbs)) {
        return -1;
      }
    } else if (xDir.startsWith(yDir)) {
      return 1;
    } else if (yDir.startsWith(xDir)) {
      return -1;
    }

    return 0;
  });
}

export function getVars(
  registry: VariableRegistry,
  dir: string,
  vars: PackageVariables = registry[dir] || {}
): PackageVariables {
  const dirAbs = toAbsolutePath(dir);
  const parentDir = upath.dirname(dirAbs);
  if (parentDir === dirAbs) {
    return vars;
  }
  const parentVars = registry[parentDir] || {};
  return getVars(registry, parentDir, { ...parentVars, ...vars });
}
