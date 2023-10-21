import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { CargoLockSchema, CargoLockSchemaToml } from './schema';

export async function extractLockFileVersions(
  lockFilePath: string
): Promise<Map<string, string[]>> {
  const versionsByPackage = new Map<string, string[]>();
  const content = await readLocalFile(lockFilePath, 'utf8');
  if (!content) {
    return versionsByPackage;
  }
  return extractLockFileContentVersions(content);
}

export function extractLockFileContentVersions(
  content: string
): Map<string, string[]> {
  const versionsByPackage = new Map<string, string[]>();
  const lock = parseLockFile(content);
  if (!lock) {
    return versionsByPackage;
  }
  const packages = lock.package ?? [];
  for (const pkg of packages) {
    const versions = versionsByPackage.get(pkg.name) ?? [];
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
