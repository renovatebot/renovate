import stream from 'node:stream';
import util from 'node:util';
import is from '@sindresorhus/is';
import findUp from 'find-up';
import fs from 'fs-extra';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import { ensureCachePath, ensureLocalPath, isValidPath } from './util';

export const pipeline = util.promisify(stream.pipeline);

export function getParentDir(fileName: string): string {
  return upath.parse(fileName).dir;
}

export function getSiblingFileName(
  fileName: string,
  siblingName: string,
): string {
  const subDirectory = getParentDir(fileName);
  return upath.join(subDirectory, siblingName);
}

export async function readLocalFile(fileName: string): Promise<Buffer | null>;
export async function readLocalFile(
  fileName: string,
  encoding: 'utf8',
): Promise<string | null>;
export async function readLocalFile(
  fileName: string,
  encoding?: BufferEncoding,
): Promise<string | Buffer | null> {
  const localFileName = ensureLocalPath(fileName);
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

export async function readLocalSymlink(
  fileName: string,
): Promise<string | null> {
  const localFileName = ensureLocalPath(fileName);
  try {
    const linkContent = await fs.readlink(localFileName);
    return linkContent;
  } catch (err) {
    logger.trace({ err }, 'Error reading local symlink');
    return null;
  }
}

export async function writeLocalFile(
  fileName: string,
  fileContent: string | Buffer,
): Promise<void> {
  const localFileName = ensureLocalPath(fileName);
  await fs.outputFile(localFileName, fileContent);
}

export async function deleteLocalFile(fileName: string): Promise<void> {
  // This a failsafe and hopefully will never be triggered
  if (GlobalConfig.get('platform') === 'local') {
    throw new Error('Cannot delete file when platform=local');
  }
  const localDir = GlobalConfig.get('localDir');
  if (localDir) {
    const localFileName = ensureLocalPath(fileName);
    await fs.remove(localFileName);
  }
}

export async function renameLocalFile(
  fromFile: string,
  toFile: string,
): Promise<void> {
  const fromPath = ensureLocalPath(fromFile);
  const toPath = ensureLocalPath(toFile);
  await fs.move(fromPath, toPath);
}

export async function ensureDir(dirName: string): Promise<void> {
  if (is.nonEmptyString(dirName)) {
    await fs.ensureDir(dirName);
  }
}

export async function ensureLocalDir(dirName: string): Promise<string> {
  const fullPath = ensureLocalPath(dirName);
  await fs.ensureDir(fullPath);
  return fullPath;
}

export async function ensureCacheDir(name: string): Promise<string> {
  const cacheDirName = ensureCachePath(`others/${name}`);
  await fs.ensureDir(cacheDirName);
  return cacheDirName;
}

/**
 * Return the path of the private cache directory. This directory is wiped
 * between repositories, so they can be used to store private registries' index
 * without risk of that information leaking to other repositories/users.
 */
export function privateCacheDir(): string {
  const cacheDir = GlobalConfig.get('cacheDir');
  return upath.join(cacheDir, '__renovate-private-cache');
}

export async function localPathExists(pathName: string): Promise<boolean> {
  // Works for both files as well as directories
  const path = ensureLocalPath(pathName);
  try {
    const s = await fs.stat(path);
    return !!s;
  } catch (_) {
    return false;
  }
}

/**
 * Validate local path without throwing.
 * @param path Path to check
 * @returns `true` if given `path` is a valid local path, otherwise `false`.
 */
export function isValidLocalPath(path: string): boolean {
  return isValidPath(path, 'localDir');
}

/**
 * Tries to find `otherFileName` in the directory where
 * `existingFileNameWithPath` is, then in its parent directory, then in the
 * grandparent, until we reach the top-level directory. All paths
 * must be relative to `localDir`.
 */
export async function findLocalSiblingOrParent(
  existingFileNameWithPath: string,
  otherFileName: string,
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
  const localPath = ensureLocalPath(path);
  const fileList = await fs.readdir(localPath);
  return fileList;
}

export function createCacheWriteStream(path: string): fs.WriteStream {
  const fullPath = ensureCachePath(path);
  return fs.createWriteStream(fullPath);
}

export async function localPathIsFile(pathName: string): Promise<boolean> {
  const path = ensureLocalPath(pathName);
  try {
    const s = await fs.stat(path);
    return s.isFile();
  } catch (_) {
    return false;
  }
}

export async function localPathIsSymbolicLink(
  pathName: string,
): Promise<boolean> {
  const path = ensureLocalPath(pathName);
  try {
    const s = await fs.lstat(path);
    return s.isSymbolicLink();
  } catch (_) {
    return false;
  }
}

/**
 * Find a file or directory by walking up parent directories within localDir
 */

export async function findUpLocal(
  fileName: string | string[],
  cwd: string,
): Promise<string | null> {
  const localDir = GlobalConfig.get('localDir');
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
  mode: string | number,
): Promise<void> {
  const fullFileName = ensureLocalPath(fileName);
  return fs.chmod(fullFileName, mode);
}

export async function statLocalFile(
  fileName: string,
): Promise<fs.Stats | null> {
  const fullFileName = ensureLocalPath(fileName);
  try {
    return await fs.stat(fullFileName);
  } catch (_) {
    return null;
  }
}

export function listCacheDir(
  path: string,
  options: { recursive: boolean } = { recursive: false },
): Promise<string[]> {
  const fullPath = ensureCachePath(path);
  return fs.readdir(fullPath, {
    encoding: 'utf-8',
    recursive: options.recursive,
  });
}

export async function rmCache(path: string): Promise<void> {
  const fullPath = ensureCachePath(path);
  await fs.rm(fullPath, { recursive: true });
}

export async function cachePathExists(pathName: string): Promise<boolean> {
  const path = ensureCachePath(pathName);
  try {
    const s = await fs.stat(path);
    return !!s;
  } catch (_) {
    return false;
  }
}

export async function cachePathIsFile(pathName: string): Promise<boolean> {
  const path = ensureCachePath(pathName);
  try {
    const s = await fs.stat(path);
    return s.isFile();
  } catch (e) {
    return false;
  }
}

export async function readCacheFile(fileName: string): Promise<Buffer>;
export async function readCacheFile(
  fileName: string,
  encoding: 'utf8',
): Promise<string>;
export function readCacheFile(
  fileName: string,
  encoding?: BufferEncoding,
): Promise<string | Buffer> {
  const fullPath = ensureCachePath(fileName);
  return encoding ? fs.readFile(fullPath, encoding) : fs.readFile(fullPath);
}

export function outputCacheFile(
  file: string,
  data: string | NodeJS.ArrayBufferView,
): Promise<void> {
  const filePath = ensureCachePath(file);
  return fs.outputFile(filePath, data);
}

export async function readSystemFile(fileName: string): Promise<Buffer>;
export async function readSystemFile(
  fileName: string,
  encoding: 'utf8',
): Promise<string>;
export function readSystemFile(
  fileName: string,
  encoding?: BufferEncoding,
): Promise<string | Buffer> {
  return encoding ? fs.readFile(fileName, encoding) : fs.readFile(fileName);
}

export async function writeSystemFile(
  fileName: string,
  data: string | Buffer,
): Promise<void> {
  await fs.outputFile(fileName, data);
}

export async function getLocalFiles(
  fileNames: string[],
): Promise<Record<string, string | null>> {
  const fileContentMap: Record<string, string | null> = {};

  for (const fileName of fileNames) {
    fileContentMap[fileName] = await readLocalFile(fileName, 'utf8');
  }

  return fileContentMap;
}
