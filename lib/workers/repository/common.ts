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
      .map(
        (problem) =>
          `${nameFromLevel[problem.level].toUpperCase()}: ${problem.msg}`,
      ),
  );
}
