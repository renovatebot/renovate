import { logger } from '../../../../logger/index.ts';
import { minimatch } from '../../../../util/minimatch.ts';

export function matchesAnyPattern(val: string, patterns: string[]): boolean {
  const res = patterns.some(
    (pattern) =>
      pattern === `${val}/` || minimatch(pattern, { dot: true }).match(val),
  );
  logger.trace({ val, patterns, res }, `matchesAnyPattern`);
  return res;
}
