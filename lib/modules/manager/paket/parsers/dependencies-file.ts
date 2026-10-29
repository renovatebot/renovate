import { isNonEmptyStringAndNotWhitespace } from '@sindresorhus/is';
import { newlineRegex, regEx } from '../../../../util/regex.ts';
import type {
  DependenciesFile,
  DependenciesFileGroup,
  DependenciesFilePackage,
} from '../types.ts';

interface ParseState {
  groups: DependenciesFileGroup[];
  currentGroup: DependenciesFileGroup;
}

// https://fsprojects.github.io/Paket/nuget-dependencies.html
const versionConstraintTokenRegex = regEx(/^(?:[!@]?(?:>=|<=|==|~>|[><=])|\d)/);
const commentRegex = regEx(/(?:^|\s)\/\/.*$/);

function extractVersionConstraint(tokens: string[]): string | undefined {
  const constraintLength = tokens.findIndex(
    (t) => !versionConstraintTokenRegex.test(t),
  );
  const splitAt = constraintLength === -1 ? tokens.length : constraintLength;
  return tokens.slice(0, splitAt).join(' ') || undefined;
}

function analyzeLine(state: ParseState, line: string): void {
  const lineParts = line
    .replace(commentRegex, '')
    .split(regEx(/\s+/))
    .filter(isNonEmptyStringAndNotWhitespace);
  if (lineParts.length < 2) {
    return;
  }

  switch (lineParts[0]) {
    case 'nuget': {
      const pkg: DependenciesFilePackage = { name: lineParts[1] };
      const versionConstraint = extractVersionConstraint(lineParts.slice(2));
      if (versionConstraint) {
        pkg.versionConstraint = versionConstraint;
      }
      state.currentGroup.nugetPackages.push(pkg);
      break;
    }
    case 'source':
      state.currentGroup.sources.push(lineParts[1]);
      break;
    case 'group':
      state.groups.push(state.currentGroup);
      state.currentGroup = {
        groupName: lineParts[1],
        sources: [],
        nugetPackages: [],
      };
  }
}

export function parse(content: string): DependenciesFile {
  const state: ParseState = {
    groups: [],
    currentGroup: { groupName: 'Main', sources: [], nugetPackages: [] },
  };

  for (const line of content.split(newlineRegex)) {
    analyzeLine(state, line);
  }

  state.groups.push(state.currentGroup);

  return {
    groups: state.groups,
  };
}
