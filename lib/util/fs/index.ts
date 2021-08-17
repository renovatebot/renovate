import stream from 'stream';
import util from 'util';
import is from '@sindresorhus/is';
import * as fs from 'fs-extra';
import { isAbsolute, join, parse } from 'upath';
import { getGlobalConfig } from '../../config/global';
import { logger } from '../../logger';

export * from './proxies';

export const pipeline = util.promisify(stream.pipeline);

export function getSubDirectory(fileName: string): string {
  return parse(fileName).dir;
}

export function getSiblingFileName(
  existingFileNameWithPath: string,
  otherFileName: string
): string {
  const subDirectory = getSubDirectory(existingFileNameWithPath);
  return join(subDirectory, otherFileName);
}

export async function readLocalFile(fileName: string): Promise<Buffer>;
export async function readLocalFile(
  fileName: string,
  encoding: 'utf8'
): Promise<string>;
export async function readLocalFile(
  fileName: string,
  encoding?: string
): Promise<string | Buffer> {
  const { localDir } = getGlobalConfig();
  const localFileName = join(localDir, fileName);
  try {
    const fileContent = await fs.readFile(localFileName, encoding);
    return fileContent;
  } catch (err) {
    logger.trace({ err }, 'Error reading local file');
    return null;
  }
}

export async function writeLocalFile(
  fileName: string,
  fileContent: string
): Promise<void> {
  const { localDir } = getGlobalConfig();
  const localFileName = join(localDir, fileName);
  await fs.outputFile(localFileName, fileContent);
}

export async function deleteLocalFile(fileName: string): Promise<void> {
  const { localDir } = getGlobalConfig();
  if (localDir) {
    const localFileName = join(localDir, fileName);
    await fs.remove(localFileName);
  }
}

// istanbul ignore next
export async function renameLocalFile(
  fromFile: string,
  toFile: string
): Promise<void> {
  const { localDir } = getGlobalConfig();
  await fs.move(join(localDir, fromFile), join(localDir, toFile));
}

// istanbul ignore next
export async function ensureDir(dirName: string): Promise<void> {
  if (is.nonEmptyString(dirName)) {
    await fs.ensureDir(dirName);
  }
}

// istanbul ignore next
export async function ensureLocalDir(dirName: string): Promise<void> {
  const { localDir } = getGlobalConfig();
  const localDirName = join(localDir, dirName);
  await fs.ensureDir(localDirName);
}

export async function ensureCacheDir(name: string): Promise<string> {
  const cacheDirName = join(getGlobalConfig().cacheDir, `others/${name}`);
  await fs.ensureDir(cacheDirName);
  return cacheDirName;
}

/**
 * Return the path of the private cache directory. This directory is wiped
 * between repositories, so they can be used to store private registries' index
 * without risk of that information leaking to other repositories/users.
 */
export function privateCacheDir(): string {
  const { cacheDir } = getGlobalConfig();
  return join(cacheDir, '__renovate-private-cache');
}

export function localPathExists(pathName: string): Promise<boolean> {
  const { localDir } = getGlobalConfig();
  // Works for both files as well as directories
  return fs
    .stat(join(localDir, pathName))
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
  if (isAbsolute(existingFileNameWithPath)) {
    return null;
  }
  if (isAbsolute(otherFileName)) {
    return null;
  }

  let current = existingFileNameWithPath;
  while (current !== '') {
    current = getSubDirectory(current);
    const candidate = join(current, otherFileName);
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
  const { localDir } = getGlobalConfig();
  const localPath = join(localDir, path);
  const fileList = await fs.readdir(localPath);
  return fileList;
}

export function createWriteStream(path: string): fs.WriteStream {
  return fs.createWriteStream(path);
}
