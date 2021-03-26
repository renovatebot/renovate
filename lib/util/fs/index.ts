import * as fs from 'fs-extra';
import { isAbsolute, join, parse } from 'upath';
import type { RenovateConfig } from '../../config/types';
import { logger } from '../../logger';

export * from './proxies';

let localDir = '';
let cacheDir = '';

export function setFsConfig(config: Partial<RenovateConfig>): void {
  localDir = config.localDir;
  cacheDir = config.cacheDir;
}

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
  const localFileName = join(localDir, fileName);
  await fs.outputFile(localFileName, fileContent);
}

export async function deleteLocalFile(fileName: string): Promise<void> {
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
  await fs.move(join(localDir, fromFile), join(localDir, toFile));
}

// istanbul ignore next
export async function ensureDir(dirName: string): Promise<void> {
  await fs.ensureDir(dirName);
}

// istanbul ignore next
export async function ensureLocalDir(dirName: string): Promise<void> {
  const localDirName = join(localDir, dirName);
  await fs.ensureDir(localDirName);
}

export async function ensureCacheDir(
  dirName: string,
  envPathVar?: string
): Promise<string> {
  const envCacheDirName = envPathVar ? process.env[envPathVar] : null;
  const cacheDirName = envCacheDirName || join(cacheDir, dirName);
  await fs.ensureDir(cacheDirName);
  return cacheDirName;
}

/**
 * Return the path of the private cache directory. This directory is wiped
 * between repositories, so they can be used to store private registries' index
 * without risk of that information leaking to other repositories/users.
 */
export function privateCacheDir(): string {
  return join(cacheDir, '__renovate-private-cache');
}

export function localPathExists(pathName: string): Promise<boolean> {
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
