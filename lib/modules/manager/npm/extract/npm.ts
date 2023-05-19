import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import { PackageLockPreV3Schema, PackageLockV3Schema } from './schema';
import type { LockFile, LockFileEntry } from './types';

export async function getNpmLock(filePath: string): Promise<LockFile> {
  // TODO #7154
  const lockRaw = (await readLocalFile(filePath, 'utf8'))!;
  try {
    const lockParsed = JSON.parse(lockRaw);
    const lockedVersions: Record<string, string> = {};
    const { packages, lockfileVersion } = extractPackages(lockParsed);
    for (const [entry, val] of Object.entries(packages)) {
      logger.trace({ entry, version: val.version });
      lockedVersions[entry] = val.version;
    }
    return { lockedVersions, lockfileVersion };
  } catch (err) {
    logger.debug({ filePath, err }, 'Warning: Exception parsing npm lock file');
    return { lockedVersions: {} };
  }
}

export function extractPackages(lockParsed: any): {
  packages: LockFileEntry;
  lockfileVersion: number;
} {
  const packageLockPreV3ParseResult =
    PackageLockPreV3Schema.safeParse(lockParsed);
  const packageLockV3ParseResult = PackageLockV3Schema.safeParse(lockParsed);

  if (packageLockPreV3ParseResult.success) {
    return {
      packages: packageLockPreV3ParseResult.data.dependencies ?? {},
      lockfileVersion: packageLockPreV3ParseResult.data.lockfileVersion,
    };
  } else if (packageLockV3ParseResult.success) {
    return {
      packages: packageLockV3ParseResult.data.packages,
      lockfileVersion: packageLockV3ParseResult.data.lockfileVersion,
    };
  } else {
    throw new Error(
      'Invalid package-lock file. Neither v1, v2 nor v3 schema matched'
    );
  }
}
