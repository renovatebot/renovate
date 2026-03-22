import upath from 'upath';
import { scm } from '../modules/platform/scm.ts';
import { minimatchFilter } from './minimatch.ts';

/**
 * Take a relative path reference from a repo-relative file and resolve it
 * to a repo-relative path. Uses a virtual root to avoid upath.resolve
 * prepending the real cwd for relative paths.
 *
 * Shared between NuGet (ProjectReference) and Go (replace directive) managers.
 */
export function resolveRelativePathToRoot(
  baseFilePath: string,
  relativePath: string,
): string {
  const virtualRoot = '/';
  const absoluteBase = upath.resolve(virtualRoot, baseFilePath);
  const absoluteResolved = upath.resolve(
    upath.dirname(absoluteBase),
    relativePath,
  );
  return upath.relative(virtualRoot, absoluteResolved);
}

/**
 * Get a list of files in the repository matching a minimatch filter pattern.
 * Shared between managers for building dependency graphs from specific file types.
 */
export async function getMatchingFiles(pattern: string): Promise<string[]> {
  const allFiles = await scm.getFileList();
  return allFiles.filter(
    minimatchFilter(pattern, { matchBase: true, nocase: true }),
  );
}
