import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { readLocalFile } from '../../../util/fs';
import type { CargoLockSchema } from './schema';
import { CargoLockSchemaToml } from './schema';

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

export function parseLockFile(lockFile: string): CargoLockSchema | null {
  const res = CargoLockSchemaToml.safeParse(lockFile);
  if (res.success) {
    return res.data;
  }
  logger.debug({ err: res.error }, 'Error parsing Cargo lockfile.');
  return null;
}
