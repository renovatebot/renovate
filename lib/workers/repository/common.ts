import { DEBUG, ERROR, FATAL, INFO, TRACE, WARN, nameFromLevel } from 'bunyan';
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
      .map(
        (problem) =>
          `${emojiFromLevel(problem.level)} ${nameFromLevel[problem.level].toUpperCase()}: ${problem.msg}`,
      ),
  );
}

function emojiFromLevel(level: number): string {
  switch (level) {
    case TRACE:
      return '🔬';
    case DEBUG:
      return '🔍';
    case INFO:
      return 'ℹ️';
    case WARN:
      return '⚠️';
    case ERROR:
      return '❌';
    case FATAL:
      return '💀';
    default:
      return '';
  }
}
