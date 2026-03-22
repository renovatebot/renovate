import upath from 'upath';
import { GlobalConfig } from '../../config/global.ts';
import { FILE_ACCESS_VIOLATION_ERROR } from '../../constants/error-messages.ts';
import { logger } from '../../logger/index.ts';

/**
 * Take a relative path reference from a repo-relative file and resolve it
 * to a repo-relative path. Uses a virtual root to avoid upath.resolve
 * prepending the real cwd for relative paths.
 *
 * Shared between NuGet (ProjectReference) and Go (replace directive) managers.
 */
export function resolveRelativePathToRoot(
  baseFilePath: string,
  relativePath: string,
): string {
  const virtualRoot = '/';
  const absoluteBase = upath.resolve(virtualRoot, baseFilePath);
  const absoluteResolved = upath.resolve(
    upath.dirname(absoluteBase),
    relativePath,
  );
  return upath.relative(virtualRoot, absoluteResolved);
}

function assertBaseDir(path: string, allowedDir: string): void {
  if (!path.startsWith(allowedDir)) {
    logger.debug(
      { path, allowedDir },
      'Preventing access to file outside allowed directory',
    );
    throw new Error(FILE_ACCESS_VIOLATION_ERROR);
  }
}

function ensurePath(path: string, key: 'localDir' | 'cacheDir'): string {
  const baseDir = upath.resolve(GlobalConfig.get(key)!);
  const fullPath = upath.resolve(
    upath.isAbsolute(path) ? path : upath.join(baseDir, path),
  );
  assertBaseDir(fullPath, baseDir);
  return fullPath;
}

export function ensureLocalPath(path: string): string {
  return ensurePath(path, 'localDir');
}

export function ensureCachePath(path: string): string {
  return ensurePath(path, 'cacheDir');
}

export function isValidPath(
  path: string,
  key: 'localDir' | 'cacheDir',
): boolean {
  const baseDir = upath.resolve(GlobalConfig.get(key)!);
  const fullPath = upath.resolve(
    upath.isAbsolute(path) ? path : upath.join(baseDir, path),
  );

  return fullPath.startsWith(baseDir);
}
