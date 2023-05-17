import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import type { LockFile, LockFileEntry } from './types';

export async function getNpmLock(filePath: string): Promise<LockFile> {
  // TODO #7154
  const lockRaw = (await readLocalFile(filePath, 'utf8'))!;
  try {
    const lockParsed = JSON.parse(lockRaw);
    const lockedVersions: Record<string, string> = {};
    for (const [entry, val] of Object.entries(getPackages(lockParsed))) {
      logger.trace({ entry, version: val.version });
      lockedVersions[entry] = val.version;
    }
    return { lockedVersions, lockfileVersion: lockParsed.lockfileVersion };
  } catch (err) {
    logger.debug({ filePath, err }, 'Warning: Exception parsing npm lock file');
    return { lockedVersions: {} };
  }
}
function getPackages(lockParsed: any): LockFileEntry {
  let packages: LockFileEntry = {};

  if (
    (lockParsed.lockfileVersion === 1 || lockParsed.lockfileVersion === 2) &&
    lockParsed.dependencies
  ) {
    packages = lockParsed.dependencies;
  } else if (lockParsed.lockfileVersion === 3 && lockParsed.packages) {
    packages = Object.fromEntries(
      Object.entries(lockParsed.packages)
        .filter(([key]) => !!key) // filter out root entry
        .map(([key, val]) => [key.replace(`node_modules/`, ''), val])
    ) as LockFileEntry;
  }
  return packages;
}
