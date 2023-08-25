import { nameFromLevel } from 'bunyan';
import type { RenovateConfig } from '../../config/types';
import { getProblems } from '../../logger';

export function extractRepoProblems(config: RenovateConfig): Set<string> {
  return new Set(
    getProblems()
      .filter(
        (problem) =>
          problem.repository === config.repository && !problem.artifactErrors
      )
      .map(
        (problem) =>
          `${nameFromLevel[problem.level].toUpperCase()}: ${problem.msg}`
      )
  );
}
