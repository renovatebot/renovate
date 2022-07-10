import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { FILE_ACCESS_VIOLATION_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';

function assertBaseDir(path: string, baseDir: string): void {
  if (!path.startsWith(upath.resolve(baseDir))) {
    logger.warn(
      { path, baseDir },
      'Preventing access to file outside the base directory'
    );
    throw new Error(FILE_ACCESS_VIOLATION_ERROR);
  }
}

export function ensureLocalPath(path: string): string {
  const localDir = GlobalConfig.get('localDir')!;
  const fullPath = path.startsWith(localDir)
    ? path
    : upath.join(localDir, path);
  assertBaseDir(fullPath, localDir);
  return fullPath;
}

export function ensureCachePath(path: string): string {
  const cacheDir = GlobalConfig.get('cacheDir')!;
  const fullPath = path.startsWith(cacheDir)
    ? path
    : upath.join(cacheDir, path);
  assertBaseDir(fullPath, cacheDir);
  return fullPath;
}
