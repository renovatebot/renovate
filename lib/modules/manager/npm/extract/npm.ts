import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import type { LockFile, LockFileEntry } from './types';

export async function getNpmLock(filePath: string): Promise<LockFile> {
  // TODO #7154
  const lockRaw = (await readLocalFile(filePath))!;
  try {
    const lockParsed = JSON.parse(lockRaw);
    const lockedVersions: Record<string, string> = {};
    for (const [entry, val] of Object.entries(
      (lockParsed.dependencies || {}) as LockFileEntry
    )) {
      logger.trace({ entry, version: val.version });
      lockedVersions[entry] = val.version;
    }
    return { lockedVersions, lockfileVersion: lockParsed.lockfileVersion };
  } catch (err) {
    logger.debug({ filePath, err }, 'Warning: Exception parsing npm lock file');
    return { lockedVersions: {} };
  }
}
