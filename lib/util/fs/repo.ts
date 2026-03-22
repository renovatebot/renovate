import { scm } from '../../modules/platform/scm.ts';
import { minimatchFilter } from '../minimatch.ts';

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
