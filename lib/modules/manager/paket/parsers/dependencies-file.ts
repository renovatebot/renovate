import { isNonEmptyStringAndNotWhitespace } from '@sindresorhus/is';
import { newlineRegex, regEx } from '../../../../util/regex.ts';
import type { DependenciesFile, DependenciesFileGroup } from '../types.ts';

interface ReduceState {
  groups: DependenciesFileGroup[];
  currentGroup: DependenciesFileGroup;
}

// https://fsprojects.github.io/Paket/nuget-dependencies.html
const versionConstraintTokenRegex = regEx(/^(?:[!@]?(?:>=|<=|==|~>|[><=])|\d)/);
const commentRegex = regEx(/(?:^|\s)\/\/.*$/);

function splitVersionConstraint(tokens: string[]): {
  versionConstraint?: string;
  options: string[];
} {
  const constraintLength = tokens.findIndex(
    (t) => !versionConstraintTokenRegex.test(t),
  );
  const splitAt = constraintLength === -1 ? tokens.length : constraintLength;
  return {
    versionConstraint: tokens.slice(0, splitAt).join(' ') || undefined,
    options: tokens.slice(splitAt),
  };
}

function analyzeLine(state: ReduceState, line: string): ReduceState {
  const lineParts = line
    .replace(commentRegex, '')
    .split(regEx(/\s+/))
    .filter(isNonEmptyStringAndNotWhitespace);
  if (lineParts.length < 2) {
    return state;
  }

  switch (lineParts[0]) {
    case 'nuget':
      state.currentGroup.nugetPackages.push({
        name: lineParts[1],
        ...splitVersionConstraint(lineParts.slice(2)),
      });
      break;
    case 'group':
      state.groups.push(state.currentGroup);
      state.currentGroup = {
        groupName: lineParts[1],
        nugetPackages: [],
      };
  }

  return state;
}

export function parse(content: string): DependenciesFile {
  let result: ReduceState = {
    groups: [],
    currentGroup: { groupName: 'Main', nugetPackages: [] },
  };

  for (const item of content.split(newlineRegex)) {
    result = analyzeLine(result, item);
  }

  result.groups.push(result.currentGroup);

  return {
    groups: result.groups,
  };
}
