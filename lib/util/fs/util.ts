import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { assertBaseDir } from './access';

function ensurePath(path: string, key: 'localDir' | 'cacheDir'): string {
  const baseDir = upath.resolve(GlobalConfig.get(key)!);
  let fullPath = path;
  if (fullPath.startsWith(baseDir)) {
    fullPath = fullPath.replace(baseDir, '');
  }
  fullPath = upath.resolve(upath.join(baseDir, fullPath));
  assertBaseDir(fullPath, baseDir);
  return fullPath;
}

export function ensureLocalPath(path: string): string {
  return ensurePath(path, 'localDir');
}

export function ensureCachePath(path: string): string {
  return ensurePath(path, 'cacheDir');
}
