import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import { PackageLock } from '../schema';
import type { LockFile } from './types';

export async function getNpmLock(filePath: string): Promise<LockFile> {
  const lockfileContent = await readLocalFile(filePath, 'utf8');
  if (!lockfileContent) {
    logger.debug({ filePath }, 'Npm: unable to read lockfile');
    return { lockedVersions: {} };
  }

  const parsedLockfile = PackageLock.safeParse(lockfileContent);
  if (!parsedLockfile.success) {
    logger.debug(
      { filePath, err: parsedLockfile.error },
      'Npm: unable to parse lockfile',
    );
    return { lockedVersions: {} };
  }

  return parsedLockfile.data;
}
