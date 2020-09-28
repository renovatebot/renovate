import * as fs from 'fs-extra';
import { join, parse } from 'upath';
import { RenovateConfig } from '../../config/common';
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
