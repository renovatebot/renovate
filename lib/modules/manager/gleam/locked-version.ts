import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { ManifestToml } from './schema.ts';

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
