import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { LockFileEntry } from './common';

export async function getNpmLock(
  filePath: string
): Promise<Record<string, string>> {
  const lockRaw = await readLocalFile(filePath, 'utf8');
  try {
    const lockParsed = JSON.parse(lockRaw);
    const lockFile: Record<string, string> = {};
    for (const [entry, val] of Object.entries(
      (lockParsed.dependencies || {}) as LockFileEntry
    )) {
      logger.trace({ entry, version: val.version });
      lockFile[entry] = val.version;
    }
    return lockFile;
  } catch (err) {
    logger.debug({ filePath, err }, 'Warning: Exception parsing npm lock file');
    return {};
  }
}
