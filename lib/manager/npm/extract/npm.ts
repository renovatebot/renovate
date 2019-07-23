import { logger } from '../../../logger';

export async function getNpmLock(filePath: string) {
  const lockRaw = await platform.getFile(filePath);
  try {
    const lockParsed = JSON.parse(lockRaw);
    const lockFile = {};
    for (const [entry, val] of Object.entries((lockParsed.dependencies ||
      {}) as Record<string, any>)) {
      logger.trace({ entry, version: val.version });
      lockFile[entry] = val.version;
    }
    return lockFile;
  } catch (err) {
    logger.info({ filePath, err }, 'Warning: Exception parsing npm lock file');
    return {};
  }
}
