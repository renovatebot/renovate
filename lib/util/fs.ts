import { parse, join } from 'upath';
import { outputFile, readFile } from 'fs-extra';
import { logger } from '../logger';

let localDir = '';

export function setFsConfig(config: any): void {
  localDir = config.localDir;
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

export async function readLocalFile(fileName: string): Promise<string> {
  const localFileName = join(localDir, fileName);
  try {
    const fileContent = await readFile(localFileName, 'utf8');
    return fileContent;
  } catch (err) /* istanbul ignore next */ {
    logger.trace({ err }, 'Error reading local file');
    return null;
  }
}

export async function writeLocalFile(
  fileName: string,
  fileContent: string
): Promise<void> {
  const localFileName = join(localDir, fileName);
  await outputFile(localFileName, fileContent);
}
