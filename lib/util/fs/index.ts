import stream from 'stream';
import util from 'util';
import is from '@sindresorhus/is';
import findUp from 'find-up';
import fs from 'fs-extra';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';

export * from './proxies';

export const pipeline = util.promisify(stream.pipeline);

function isPathInBaseDir(path: string, baseDir?: string): boolean {
  if (baseDir && !path.startsWith(upath.resolve(baseDir))) {
    logger.warn(
      { path, baseDir },
      'Preventing access to file outside the base directory'
    );
    return false;
  }

  return true;
}

export function getSubDirectory(fileName: string): string {
  return upath.parse(fileName).dir;
}

export function getSiblingFileName(
  existingFileNameWithPath: string,
  otherFileName: string
): string {
  const subDirectory = getSubDirectory(existingFileNameWithPath);
  return upath.join(subDirectory, otherFileName);
}

// TODO: can return null #7154
export async function readLocalFile(fileName: string): Promise<Buffer>;
export async function readLocalFile(
  fileName: string,
  encoding: 'utf8'
): Promise<string>;
export async function readLocalFile(
  fileName: string,
  encoding?: string
): Promise<string | Buffer | null> {
  const { localDir } = GlobalConfig.get();
  const localFileName = upath.resolve(localDir, fileName);
  if (!isPathInBaseDir(localFileName, localDir)) {
    return null;
  }

  try {
    const fileContent = encoding
      ? await fs.readFile(localFileName, encoding)
      : await fs.readFile(localFileName);
    return fileContent;
  } catch (err) {
    logger.trace({ err }, 'Error reading local file');
    return null;
  }
}

export async function writeLocalFile(
  fileName: string,
  fileContent: string | Buffer
): Promise<void> {
  const { localDir } = GlobalConfig.get();
  const localFileName = upath.resolve(localDir, fileName);
  if (!isPathInBaseDir(localFileName, localDir)) {
    return;
  }
  await fs.outputFile(localFileName, fileContent);
}

export async function deleteLocalFile(fileName: string): Promise<void> {
  const { localDir } = GlobalConfig.get();
  if (localDir) {
    const localFileName = upath.resolve(localDir, fileName);
    if (!isPathInBaseDir(localFileName, localDir)) {
      return;
    }
    await fs.remove(localFileName);
  }
}

// istanbul ignore next
export async function renameLocalFile(
  fromFile: string,
  toFile: string
): Promise<void> {
  const { localDir } = GlobalConfig.get();
  const fromPath = upath.resolve(localDir, fromFile);
  const toPath = upath.resolve(localDir, toFile);
  if (
    !isPathInBaseDir(fromPath, localDir) ||
    !isPathInBaseDir(toPath, localDir)
  ) {
    return;
  }
  await fs.move(fromPath, toPath);
}

// istanbul ignore next
export async function ensureDir(dirName: string): Promise<void> {
  if (is.nonEmptyString(dirName)) {
    await fs.ensureDir(dirName);
  }
}

// istanbul ignore next
export async function ensureLocalDir(dirName: string): Promise<void> {
  const { localDir } = GlobalConfig.get();
  const localDirName = upath.resolve(localDir, dirName);
  if (!isPathInBaseDir(localDirName, localDir)) {
    return;
  }
  await fs.ensureDir(localDirName);
}

export async function ensureCacheDir(name: string): Promise<string> {
  const { cacheDir } = GlobalConfig.get();
  const cacheDirName = upath.resolve(cacheDir, `others/${name}`);
  if (!isPathInBaseDir(cacheDirName, cacheDir)) {
    return Promise.reject();
  }

  await fs.ensureDir(cacheDirName);
  return cacheDirName;
}

/**
 * Return the path of the private cache directory. This directory is wiped
 * between repositories, so they can be used to store private registries' index
 * without risk of that information leaking to other repositories/users.
 */
export function privateCacheDir(): string {
  const { cacheDir } = GlobalConfig.get();
  return upath.join(cacheDir, '__renovate-private-cache');
}

export function localPathExists(pathName: string): Promise<boolean> {
  const { localDir } = GlobalConfig.get();
  const localPathName = upath.resolve(localDir, pathName);
  if (!isPathInBaseDir(localPathName, localDir)) {
    return Promise.resolve(false);
  }

  // Works for both files as well as directories
  return fs
    .stat(localPathName)
    .then((s) => !!s)
    .catch(() => false);
}

/**
 * Tries to find `otherFileName` in the directory where
 * `existingFileNameWithPath` is, then in its parent directory, then in the
 * grandparent, until we reach the top-level directory. All paths
 * must be relative to `localDir`.
 */
export async function findLocalSiblingOrParent(
  existingFileNameWithPath: string,
  otherFileName: string
): Promise<string | null> {
  if (upath.isAbsolute(existingFileNameWithPath)) {
    return null;
  }
  if (upath.isAbsolute(otherFileName)) {
    return null;
  }

  let current = existingFileNameWithPath;
  while (current !== '') {
    current = getSubDirectory(current);
    const candidate = upath.join(current, otherFileName);
    if (await localPathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function createWriteStream(path: string): fs.WriteStream {
  return fs.createWriteStream(path);
}

export function localPathIsFile(pathName: string): Promise<boolean> {
  const { localDir } = GlobalConfig.get();
  const localPathName = upath.resolve(localDir, pathName);
  if (!isPathInBaseDir(localPathName, localDir)) {
    return Promise.resolve(false);
  }

  return fs
    .stat(localPathName)
    .then((s) => s.isFile())
    .catch(() => false);
}

/**
 * Find a file or directory by walking up parent directories within localDir
 */

export async function findUpLocal(
  fileName: string | string[],
  cwd: string
): Promise<string | null> {
  const { localDir } = GlobalConfig.get();
  const absoluteCwd = upath.join(localDir, cwd);
  const normalizedAbsoluteCwd = upath.normalizeSafe(absoluteCwd);
  const res = await findUp(fileName, {
    cwd: normalizedAbsoluteCwd,
    type: 'file',
  });
  // Return null if nothing found
  if (!is.nonEmptyString(res) || !is.nonEmptyString(localDir)) {
    return null;
  }
  const safePath = upath.normalizeSafe(res);
  // Return relative path if file is inside of local dir
  if (safePath.startsWith(localDir)) {
    let relativePath = safePath.replace(localDir, '');
    if (relativePath.startsWith('/')) {
      relativePath = relativePath.substring(1);
    }
    return relativePath;
  }
  // Return null if found file is outside of localDir
  return null;
}
