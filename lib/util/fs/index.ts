import stream from 'stream';
import util from 'util';
import is from '@sindresorhus/is';
import fs from 'fs-extra';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';

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
  fileContent: string
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

// istanbul ignore next
export async function renameLocalFile(
  fromFile: string,
  toFile: string
): Promise<void> {
  const { localDir } = GlobalConfig.get();
  await fs.move(upath.join(localDir, fromFile), upath.join(localDir, toFile));
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
    current = getSubDirectory(current);
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

export function createWriteStream(path: string): fs.WriteStream {
  return fs.createWriteStream(path);
}
