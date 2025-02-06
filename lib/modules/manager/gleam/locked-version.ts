import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { readLocalFile } from '../../../util/fs';
import { ManifestToml } from './schema';

export async function extractLockFileVersions(
  lockFilePath: string,
): Promise<Map<string, string[]> | null> {
  const content = await readLocalFile(lockFilePath, 'utf8');
  if (!content) {
    logger.debug(`Gleam lock file ${lockFilePath} not found`);
    return null;
  }

  const versionsByPackage = new Map<string, string[]>();
  const lock = parseLockFile(content);
  if (!lock) {
    logger.debug(`Error parsing Gleam lock file ${lockFilePath}`);
    return null;
  }
  for (const pkg of coerceArray(lock.packages)) {
    const versions = coerceArray(versionsByPackage.get(pkg.name));
    versions.push(pkg.version);
    versionsByPackage.set(pkg.name, versions);
  }
  return versionsByPackage;
}

export function parseLockFile(lockFileContent: string): ManifestToml | null {
  const res = ManifestToml.safeParse(lockFileContent);
  if (res.success) {
    return res.data;
  }
  logger.debug({ err: res.error }, 'Error parsing manifest.toml.');
  return null;
}
