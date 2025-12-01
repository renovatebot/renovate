import { isNonEmptyString } from '@sindresorhus/is';

interface DependenciesFile {
  groups: DependenciesGroup[];
}
interface DependenciesGroup {
  groupName: string;
  nugetPackages: Package[];
}
interface Package {
  name: string;
  options: string[];
}
interface ReduceState {
  groups: DependenciesGroup[];
  currentGroup: DependenciesGroup;
}

function analyzeLine(state: ReduceState, line: string): ReduceState {
  const lineParts = line.split(/\s+/).filter(isNonEmptyString);
  if (lineParts.length < 2) {
    return state;
  }

  switch (lineParts[0]) {
    case 'nuget':
      state.currentGroup.nugetPackages.push({
        name: lineParts[1],
        options: lineParts.slice(2),
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

  for (const item of content.split('\n')) {
    result = analyzeLine(result, item);
  }

  if (result.currentGroup) {
    result.groups.push(result.currentGroup);
  }

  return {
    groups: result.groups,
  };
}
