import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { LockFile, LockFileEntry } from './common';

export async function getNpmLock(filePath: string): Promise<LockFile> {
  const lockRaw = await readLocalFile(filePath, 'utf8');
  try {
    const lockParsed = JSON.parse(lockRaw);
    const lockedVersions: Record<string, string> = {};
    for (const [entry, val] of Object.entries(
      (lockParsed.dependencies || {}) as LockFileEntry
    )) {
      logger.trace({ entry, version: val.version });
      lockedVersions[entry] = val.version;
    }
    return { lockedVersions };
  } catch (err) {
    logger.debug({ filePath, err }, 'Warning: Exception parsing npm lock file');
    return { lockedVersions: {} };
  }
}
