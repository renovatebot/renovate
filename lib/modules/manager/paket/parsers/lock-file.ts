export type SourceType = 'nuget';
export interface Dependency {
  source: SourceType;
  groupName: string;
  remote: string;
  packageName: string;
  version: string;
}

interface Line {
  text: string;
  indent: number;
}

function extractLines(content: string): Line[] {
  return content
    .split('\n')
    .map((line) => ({
      text: line.trim(),
      indent: /^( *)/.exec(line)![1].length,
    }))
    .filter((line) => line.text !== '');
}

export function parse(content: string): Dependency[] {
  const lines = extractLines(content);

  interface State {
    dependencies: Dependency[];
    currentSource: SourceType | null;
    currentGroupName: string;
    currentRemote: string;
  }
  const initialState: State = {
    dependencies: [],
    currentSource: null,
    currentGroupName: 'Main',
    currentRemote: '',
  };
  const finalState = lines.reduce((state, line): State => {
    if (line.indent === 0) {
      if (line.text.startsWith('GROUP ')) {
        return {
          ...state,
          currentGroupName: line.text.replace('GROUP ', ''),
          currentSource: null,
        };
      }

      if (line.text.startsWith('NUGET')) {
        return {
          ...state,
          currentSource: 'nuget',
        };
      }

      return {
        ...state,
        currentSource: null,
      };
    }

    if (state.currentSource !== 'nuget') {
      return state;
    }

    if (line.indent === 2 && line.text.startsWith('remote:')) {
      return {
        ...state,
        currentRemote: line.text.replace('remote: ', ''),
      };
    }

    if (line.indent === 4) {
      const packageMatch = /^(\S+)\s+\(([^)]+)\)/.exec(line.text);
      if (packageMatch) {
        return {
          ...state,
          dependencies: [
            ...state.dependencies,
            {
              groupName: state.currentGroupName,
              source: state.currentSource,
              remote: state.currentRemote,
              packageName: packageMatch[1],
              version: packageMatch[2],
            },
          ],
        };
      }
    }

    return state;
  }, initialState);

  return finalState.dependencies;
}
