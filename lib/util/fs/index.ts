import stream from 'stream';
import util from 'util';
import is from '@sindresorhus/is';
import findUp from 'find-up';
import fs from 'fs-extra';
import type { WriteFileOptions } from 'fs-extra';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';

export const pipeline = util.promisify(stream.pipeline);

export function getParentDir(fileName: string): string {
  return upath.parse(fileName).dir;
}

export function getSiblingFileName(
  fileName: string,
  siblingName: string
): string {
  const subDirectory = getParentDir(fileName);
  return upath.join(subDirectory, siblingName);
}

export async function readLocalFile(fileName: string): Promise<Buffer | null>;
export async function readLocalFile(
  fileName: string,
  encoding: 'utf8'
): Promise<string | null>;
export async function readLocalFile(
  fileName: string,
  encoding?: string
): Promise<string | Buffer | null> {
  const { localDir } = GlobalConfig.get();
  const localFileName = upath.join(localDir, fileName);
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
  const localFileName = upath.join(localDir, fileName);
  await fs.outputFile(localFileName, fileContent);
}

export async function deleteLocalFile(fileName: string): Promise<void> {
  const { localDir } = GlobalConfig.get();
  if (localDir) {
    const localFileName = upath.join(localDir, fileName);
    await fs.remove(localFileName);
  }
}

export async function renameLocalFile(
  fromFile: string,
  toFile: string
): Promise<void> {
  const { localDir } = GlobalConfig.get();
  await fs.move(upath.join(localDir, fromFile), upath.join(localDir, toFile));
}

export async function ensureDir(dirName: string): Promise<void> {
  if (is.nonEmptyString(dirName)) {
    await fs.ensureDir(dirName);
  }
}

export async function ensureLocalDir(dirName: string): Promise<void> {
  const { localDir } = GlobalConfig.get();
  const localDirName = upath.join(localDir, dirName);
  await fs.ensureDir(localDirName);
}

export async function ensureCacheDir(name: string): Promise<string> {
  const cacheDirName = upath.join(
    GlobalConfig.get('cacheDir'),
    `others/${name}`
  );
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
  // Works for both files as well as directories
  return fs
    .stat(upath.join(localDir, pathName))
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
    current = getParentDir(current);
    const candidate = upath.join(current, otherFileName);
    if (await localPathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Get files by name from directory
 */
export async function readLocalDirectory(path: string): Promise<string[]> {
  const { localDir } = GlobalConfig.get();
  const localPath = upath.join(localDir, path);
  const fileList = await fs.readdir(localPath);
  return fileList;
}

export function createCacheWriteStream(path: string): fs.WriteStream {
  return fs.createWriteStream(path);
}

export function localPathIsFile(pathName: string): Promise<boolean> {
  const { localDir } = GlobalConfig.get();
  return fs
    .stat(upath.join(localDir, pathName))
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

export function chmodLocalFile(
  fileName: string,
  mode: string | number
): Promise<void> {
  const localDir = GlobalConfig.get('localDir');
  const fullFileName = upath.join(localDir, fileName);
  return fs.chmod(fullFileName, mode);
}

export async function statLocalFile(
  fileName: string
): Promise<fs.Stats | null> {
  const localDir = GlobalConfig.get('localDir');
  const fullFileName = upath.join(localDir, fileName);
  try {
    return await fs.stat(fullFileName);
  } catch (_) {
    return null;
  }
}

export function listCacheDir(path: string): Promise<string[]> {
  return fs.readdir(path);
}

export async function rmCache(path: string): Promise<void> {
  await fs.rm(path, { recursive: true });
}

export async function readCacheFile(fileName: string): Promise<Buffer>;
export async function readCacheFile(
  fileName: string,
  encoding: 'utf8'
): Promise<string>;
export function readCacheFile(
  fileName: string,
  encoding?: string
): Promise<string | Buffer> {
  return encoding ? fs.readFile(fileName, encoding) : fs.readFile(fileName);
}

export function outputCacheFile(
  file: string,
  data: unknown,
  options?: WriteFileOptions | string
): Promise<void> {
  return fs.outputFile(file, data, options ?? {});
}

export async function readSystemFile(fileName: string): Promise<Buffer>;
export async function readSystemFile(
  fileName: string,
  encoding: 'utf8'
): Promise<string>;
export function readSystemFile(
  fileName: string,
  encoding?: string
): Promise<string | Buffer> {
  return encoding ? fs.readFile(fileName, encoding) : fs.readFile(fileName);
}
