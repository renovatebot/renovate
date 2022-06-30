import stream from 'stream';
import util from 'util';
import is from '@sindresorhus/is';
import findUp from 'find-up';
import fs from 'fs-extra';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import { assertBaseDir } from './util';

export * from './proxies';

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
  const localDir = GlobalConfig.get('localDir');
  const localFileName = upath.resolve(localDir, fileName);
  assertBaseDir(localFileName, localDir!);

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
  const localDir = GlobalConfig.get('localDir');
  const localFileName = upath.resolve(localDir, fileName);
  assertBaseDir(localFileName, localDir!);
  await fs.outputFile(localFileName, fileContent);
}

export async function deleteLocalFile(fileName: string): Promise<void> {
  const localDir = GlobalConfig.get('localDir');
  const localFileName = upath.resolve(localDir, fileName);
  assertBaseDir(localFileName, localDir!);
  await fs.remove(localFileName);
}

// istanbul ignore next
export async function renameLocalFile(
  fromFile: string,
  toFile: string
): Promise<void> {
  const localDir = GlobalConfig.get('localDir');
  const fromPath = upath.resolve(localDir, fromFile);
  const toPath = upath.resolve(localDir, toFile);
  assertBaseDir(fromPath, localDir!);
  assertBaseDir(toPath, localDir!);
  await fs.move(fromPath, toPath);
}

// istanbul ignore next
export async function ensureDir(dirName: string): Promise<void> {
  if (is.nonEmptyString(dirName)) {
    await fs.ensureDir(dirName);
  }
}

export async function ensureLocalDir(dirName: string): Promise<string> {
  const localDir = GlobalConfig.get('localDir');
  const localDirName = upath.resolve(localDir, dirName);
  assertBaseDir(localDirName, localDir!);

  await fs.ensureDir(localDirName);
  return localDirName;
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
  const localDir = GlobalConfig.get('localDir');
  const localPathName = upath.resolve(localDir, pathName);
  assertBaseDir(localPathName, localDir!);

  // Works for both files as well as directories
  try {
    const s = await fs.stat(localPathName);
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
  const localDir = GlobalConfig.get('localDir');
  const localPathName = upath.resolve(localDir, pathName);
  assertBaseDir(localPathName, localDir!);

  try {
    const s = await fs.stat(localPathName);
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
