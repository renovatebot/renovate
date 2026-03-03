import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { CargoLock } from './schema.ts';

export async function extractLockFileVersions(
  lockFilePath: string,
): Promise<Map<string, string[]> | null> {
  const content = await readLocalFile(lockFilePath, 'utf8');
  if (content) {
    return extractLockFileContentVersions(content);
  }
  return null;
}

export function extractLockFileContentVersions(
  content: string,
): Map<string, string[]> | null {
  const versionsByPackage = new Map<string, string[]>();
  const lock = parseLockFile(content);
  if (!lock) {
    return null;
  }
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
