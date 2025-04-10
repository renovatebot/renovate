import upath from 'upath';
import { minimatch } from '../../../util/minimatch.js';

export function fileMatchesWorkspaces(
  pwd: string,
  fileName: string,
  workspaces: string[],
): boolean {
  if (!fileName.startsWith(pwd)) {
    return false;
  }
  const relativeFile = upath
    .relative(pwd, fileName)
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
