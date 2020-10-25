import { regEx } from '../../util/regex';
import { PackageDependency } from '../common';
import { ManagerData, PackageVariables, Token, TokenType } from './common';

const artifactRegex = regEx(
  '^[a-zA-Z][-_a-zA-Z0-9]*(?:.[a-zA-Z][-_a-zA-Z0-9]*)*$'
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
