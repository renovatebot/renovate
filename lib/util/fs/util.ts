import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { FILE_ACCESS_VIOLATION_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';

function assertBaseDir(path: string, baseDir: string, debug = false): void {
  if (!path.startsWith(upath.resolve(baseDir))) {
    logger.warn(
      { path, baseDir },
      'Preventing access to file outside the base directory'
    );
    throw new Error(FILE_ACCESS_VIOLATION_ERROR);
  }
  // istanbul ignore if
  if (
    process.platform === 'win32' &&
    debug &&
    (path.endsWith('passwd') || path.endsWith('bar'))
  ) {
    throw { path, baseDir };
  }
}

function ensurePath(
  path: string,
  key: 'localDir' | 'cacheDir',
  debug = false
): string {
  const baseDir = upath.resolve(GlobalConfig.get(key)!);
  let fullPath = path;
  if (fullPath.startsWith(baseDir)) {
    fullPath = fullPath.replace(baseDir, '');
  }
  fullPath = upath.resolve(upath.join(baseDir, fullPath));
  assertBaseDir(fullPath, baseDir, debug);
  return fullPath;
}

export function ensureLocalPath(path: string, debug = false): string {
  return ensurePath(path, 'localDir', debug);
}

export function ensureCachePath(path: string, debug = false): string {
  return ensurePath(path, 'cacheDir', debug);
}
