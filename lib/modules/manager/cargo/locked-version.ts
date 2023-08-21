import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { CargoLockSchema, CargoLockSchemaToml } from './schema';

export async function extractLockFileVersions(
  lockFilePath: string
): Promise<Map<string, string[]>> {
  const versionsByPackage = new Map<string, string[]>();
  try {
    const content = await readLocalFile(lockFilePath);
    const lock = parseLockFile(content!.toString())!;
    const packages = lock.package ?? [];
    for (const pkg of packages) {
      const versions = versionsByPackage.get(pkg.name) ?? [];
      versions.push(pkg.version);
      versionsByPackage.set(pkg.name, versions);
    }
  } catch (err) {
    logger.warn({ err }, `Failed to parse Cargo lockfile`);
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
