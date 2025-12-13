import { isNonEmptyString } from '@sindresorhus/is';
import { newlineRegex, regEx } from '../../../../util/regex';

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
    .split(newlineRegex)
    .map((line) => ({
      text: line.trim(),
      indent: regEx(/^(\s*)/).exec(line)![1].length,
    }))
    .filter((line) => isNonEmptyString(line.text));
}

interface ReduceState {
  dependencies: Dependency[];
  currentSource: SourceType | null;
  currentGroupName: string;
  currentRemote: string;
}
function parseLine(line: Line, state: ReduceState): ReduceState {
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
}

export function parse(content: string): Dependency[] {
  const lines = extractLines(content);

  let result: ReduceState = {
    dependencies: [],
    currentSource: null,
    currentGroupName: 'Main',
    currentRemote: '',
  };
  for (const line of lines) {
    result = parseLine(line, result);
  }

  return result.dependencies;
}
