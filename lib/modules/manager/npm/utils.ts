import detectIndent from 'detect-indent';
import upath from 'upath';
import { logger } from '../../../logger';
import {
  deleteLocalFile,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import type { LockFile, ParseLockFileResult } from './types';

export function parseLockFile(lockFile: string): ParseLockFileResult {
  const detectedIndent = detectIndent(lockFile).indent || '  ';

  let lockFileParsed: LockFile | undefined;
  try {
    lockFileParsed = JSON.parse(lockFile);
  } catch (err) {
    logger.warn({ err }, 'Error parsing npm lock file');
  }

  return { detectedIndent, lockFileParsed };
}

export function composeLockFile(lockFile: LockFile, indent: string): string {
  return JSON.stringify(lockFile, null, indent) + '\n';
}

export async function getNpmrcContent(dir: string): Promise<string | null> {
  const npmrcFilePath = upath.join(dir, '.npmrc');
  let originalNpmrcContent: string | null = null;
  try {
    originalNpmrcContent = await readLocalFile(npmrcFilePath, 'utf8');
  } catch /* istanbul ignore next */ {
    originalNpmrcContent = null;
  }
  if (originalNpmrcContent) {
    logger.debug(`npmrc file ${npmrcFilePath} found in repository`);
  }
  return originalNpmrcContent;
}

export async function updateNpmrcContent(
  dir: string,
  originalContent: string | null,
  additionalLines: string[],
): Promise<void> {
  const npmrcFilePath = upath.join(dir, '.npmrc');
  const newNpmrc = originalContent
    ? [originalContent, ...additionalLines]
    : additionalLines;
  try {
    const newContent = newNpmrc.length ? newNpmrc.join('\n') : null;
    if (newContent !== originalContent) {
      logger.debug(`Writing updated .npmrc file to ${npmrcFilePath}`);
      await writeLocalFile(npmrcFilePath, `${newContent}\n`);
    }
  } catch /* istanbul ignore next */ {
    logger.warn('Unable to write custom npmrc file');
  }
}

export async function resetNpmrcContent(
  dir: string,
  originalContent: string | null,
): Promise<void> {
  const npmrcFilePath = upath.join(dir, '.npmrc');
  if (originalContent) {
    try {
      await writeLocalFile(npmrcFilePath, originalContent);
    } catch /* istanbul ignore next */ {
      logger.warn('Unable to reset npmrc to original contents');
    }
  } else {
    try {
      await deleteLocalFile(npmrcFilePath);
    } catch /* istanbul ignore next */ {
      logger.warn('Unable to delete custom npmrc');
    }
  }
}
