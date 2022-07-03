import stream from 'stream';
import util from 'util';
import is from '@sindresorhus/is';
import findUp from 'find-up';
import fs from 'fs-extra';
import type { WriteFileOptions } from 'fs-extra';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import { assertBaseDir } from './util';

function ensureLocalPath(path: string): string {
  const localDir = GlobalConfig.get('localDir');
  const fullPath = upath.isAbsolute(path)
    ? path
    : upath.resolve(localDir, path);
  assertBaseDir(fullPath, localDir!);
  return fullPath;
}

export const pipeline = util.promisify(stream.pipeline);

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

export async function readLocalFile(fileName: string): Promise<Buffer | null>;
export async function readLocalFile(
  fileName: string,
  encoding: 'utf8'
): Promise<string | null>;
export async function readLocalFile(
  fileName: string,
  encoding?: string
): Promise<string | Buffer | null> {
  const fullPath = ensureLocalPath(fileName);

  try {
    const fileContent = encoding
      ? await fs.readFile(fullPath, encoding)
      : await fs.readFile(fullPath);
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
  const fullPath = ensureLocalPath(fileName);
  await fs.outputFile(fullPath, fileContent);
}

export async function deleteLocalFile(fileName: string): Promise<void> {
  const fullPath = ensureLocalPath(fileName);
  await fs.remove(fullPath);
}

// istanbul ignore next
export async function renameLocalFile(
  fromFile: string,
  toFile: string
): Promise<void> {
  const fromPath = ensureLocalPath(fromFile);
  const toPath = ensureLocalPath(toFile);
  await fs.move(fromPath, toPath);
}

// istanbul ignore next
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
  const cacheDir = GlobalConfig.get('cacheDir');
  const cacheDirName = upath.resolve(cacheDir, `others/${name}`);
  assertBaseDir(cacheDirName, cacheDir!);

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
  const fullPath = ensureLocalPath(pathName);

  // Works for both files as well as directories
  try {
    const s = await fs.stat(fullPath);
    return !!s;
  } catch (_) {
    return false;
  }
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

export async function localPathIsFile(pathName: string): Promise<boolean> {
  const fullPath = ensureLocalPath(pathName);

  try {
    const s = await fs.stat(fullPath);
    return s.isFile();
  } catch (_) {
    return false;
  }
}

/**
 * Find a file or directory by walking up parent directories within localDir
 */

export async function findUpLocal(
  fileName: string | string[],
  cwd: string
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
  mode: string | number
): Promise<void> {
  const fullFileName = ensureLocalPath(fileName);
  return fs.chmod(fullFileName, mode);
}

export async function statLocalFile(
  fileName: string
): Promise<fs.Stats | null> {
  const fullPath = ensureLocalPath(fileName);
  try {
    return await fs.stat(fullPath);
  } catch (_) {
    return null;
  }
}

// istanbul ignore next
export function listCacheDir(path: string): Promise<string[]> {
  return fs.readdir(path);
}

// istanbul ignore next
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
