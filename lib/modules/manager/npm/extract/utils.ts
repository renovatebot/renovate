import { logger } from '../../../../logger';
import { minimatch } from '../../../../util/minimatch';

export function matchesAnyPattern(val: string, patterns: string[]): boolean {
  const res = patterns.some(
    (pattern) =>
      pattern === `${val}/` || minimatch(pattern, { dot: true }).match(val),
  );
  logger.trace({ val, patterns, res }, `matchesAnyPattern`);
  return res;
}

export function fileMatchesWorkspaces(
  pwd: string,
  fileName: string,
  workspaces: string[],
): boolean {
  if (!fileName.startsWith(pwd)) {
    return false;
  }
  const relativeFile = fileName
    .slice(pwd.length)
    .replace(/^\//, '')
    .replace(/\/package\.json$/, '');
  return workspaces.some((pattern) =>
    // minimatch will also return true for an exact match
    minimatch(pattern, { dot: true }).match(relativeFile),
  );
}

export function filesMatchingWorkspaces(
  pwd: string,
  files: string[],
  workspaces: string[],
): string[] {
  return files.filter((file) => fileMatchesWorkspaces(pwd, file, workspaces));
}
