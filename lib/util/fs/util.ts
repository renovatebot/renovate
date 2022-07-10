import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { assertBaseDir } from './access';

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
