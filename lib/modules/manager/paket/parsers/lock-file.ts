import { isNonEmptyStringAndNotWhitespace } from '@sindresorhus/is';
import { newlineRegex, regEx } from '../../../../util/regex.ts';
import type { LockFileDependency, LockFileSourceType } from '../types.ts';

interface Line {
  text: string;
  indent: number;
}

function extractLines(content: string): Line[] {
  return content
    .split(newlineRegex)
    .map((line) => ({
      text: line.trim(),
      indent: line.length - line.trimStart().length,
    }))
    .filter((line) => isNonEmptyStringAndNotWhitespace(line.text));
}

const packageRegex = regEx(/^(?<packageName>\S+)\s+\((?<version>[^)]+)\)/);

interface ParseState {
  dependencies: LockFileDependency[];
  currentSource: LockFileSourceType | null;
  currentGroupName: string;
}

function parseLine(line: Line, state: ParseState): void {
  if (line.indent === 0) {
    if (line.text.startsWith('GROUP ')) {
      state.currentGroupName = line.text.replace('GROUP ', '');
      state.currentSource = null;
      return;
    }

    state.currentSource = line.text.startsWith('NUGET') ? 'nuget' : null;
    return;
  }

  if (state.currentSource !== 'nuget' || line.indent !== 4) {
    return;
  }

  const packageMatch = packageRegex.exec(line.text);
  if (packageMatch?.groups) {
    state.dependencies.push({
      groupName: state.currentGroupName,
      packageName: packageMatch.groups.packageName,
      version: packageMatch.groups.version,
    });
  }
}

export function parse(content: string): LockFileDependency[] {
  const state: ParseState = {
    dependencies: [],
    currentSource: null,
    currentGroupName: 'Main',
  };
  for (const line of extractLines(content)) {
    parseLine(line, state);
  }

  return state.dependencies;
}
