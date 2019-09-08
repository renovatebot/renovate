import { logger } from '../../../logger';
import { LockFileEntry } from './common';
import { platform } from '../../../platform';

export async function getNpmLock(
  filePath: string
): Promise<Record<string, string>> {
  const lockRaw = await platform.getFile(filePath);
  try {
    const lockParsed = JSON.parse(lockRaw);
    const lockFile: Record<string, string> = {};
    for (const [entry, val] of Object.entries((lockParsed.dependencies ||
      {}) as LockFileEntry)) {
      logger.trace({ entry, version: val.version });
      lockFile[entry] = val.version;
    }
    return lockFile;
  } catch (err) {
    logger.info({ filePath, err }, 'Warning: Exception parsing npm lock file');
    return {};
  }
}
