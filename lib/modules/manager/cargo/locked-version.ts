import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { CargoLock } from './schema.ts';
import type { CargoLockFileVersions } from './types.ts';

export async function extractLockFileVersions(
  lockFilePath: string,
): Promise<CargoLockFileVersions | null> {
  const content = await readLocalFile(lockFilePath, 'utf8');
  const lock = content ? parseLockFile(content) : null;
  if (!lock) {
    return null;
  }
  return {
    versionsByPackage: getLockedVersions(lock),
    hasGitSources: coerceArray(lock.package).some((pkg) =>
      pkg.source?.startsWith('git+'),
    ),
  };
}

export function extractLockFileContentVersions(
  content: string,
): Map<string, string[]> | null {
  const lock = parseLockFile(content);
  return lock ? getLockedVersions(lock) : null;
}

function getLockedVersions(lock: CargoLock): Map<string, string[]> {
  const versionsByPackage = new Map<string, string[]>();
  for (const pkg of coerceArray(lock.package)) {
    const versions = coerceArray(versionsByPackage.get(pkg.name));
    versions.push(pkg.version);
    versionsByPackage.set(pkg.name, versions);
  }
  return versionsByPackage;
}

export function parseLockFile(lockFile: string): CargoLock | null {
  const res = CargoLock.safeParse(lockFile);
  if (res.success) {
    return res.data;
  }
  logger.debug({ err: res.error }, 'Error parsing Cargo lockfile.');
  return null;
}
