import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import type { PackageFileContent } from '../types';
import { getLockFilePath } from './common';
import { extractLockFileEntries } from './locked-version';
import { parseGemfile } from './parser';

export async function extractPackageFile(
  content: string,
  packageFile?: string,
): Promise<PackageFileContent | null> {
  const deps = parseGemfile(content);

  if (!deps.length) {
    return null;
  }

  const res: PackageFileContent = { deps };
  if (packageFile) {
    const gemfileLockPath = await getLockFilePath(packageFile);
    const lockContent = await readLocalFile(gemfileLockPath, 'utf8');
    if (lockContent) {
      logger.debug(
        `Found lock file ${gemfileLockPath} for packageFile: ${packageFile}`,
      );
      res.lockFiles = [gemfileLockPath];
      const lockedEntries = extractLockFileEntries(lockContent);
      for (const dep of res.deps) {
        if (dep.depName) {
          const lockedDepValue = lockedEntries.get(dep.depName);
          if (lockedDepValue) {
            dep.lockedVersion = lockedDepValue;
            if (dep.skipReason === 'unspecified-version') {
              delete dep.skipReason;
            }
          }
        }
      }
    }
  }

  return res;
}
