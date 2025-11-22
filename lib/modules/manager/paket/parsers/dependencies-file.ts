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

export function parse(content: string): DependenciesFile {
  const result: ReduceState = content.split('\n').reduce(
    (state: ReduceState, line: string) => {
      const lineParts = line.split(/\s+/).filter((p) => p !== '');
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
    },
    { groups: [], currentGroup: { groupName: 'Main', nugetPackages: [] } },
  );

  if (result.currentGroup) {
    result.groups.push(result.currentGroup);
  }

  return {
    groups: result.groups,
  };
}
