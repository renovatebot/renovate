import type { LogLevelString } from 'bunyan';
import { nameFromLevel } from 'bunyan';
import { getProblems } from '../../logger';

export function extractRepoProblems(
  repository: string | undefined,
): Set<string> {
  return new Set(
    getProblems()
      .filter(
        (problem) =>
          problem.repository === repository && !problem.artifactErrors,
      )
      .map((problem) => {
        const levelName = nameFromLevel[problem.level];

        return `${emojiFromLevel(levelName as LogLevelString)} ${levelName.toUpperCase()}: ${problem.msg}`;
      }),
  );
}

function emojiFromLevel(levelName: LogLevelString): string {
  const level = levelName.toLowerCase();

  switch (level) {
    case 'trace':
      return '🔬';
    case 'debug':
      return '🔍';
    case 'info':
      return 'ℹ️';
    case 'warn':
      return '⚠️';
    case 'error':
      return '❌';
    case 'fatal':
      return '💀';
    default:
      return '';
  }
}
