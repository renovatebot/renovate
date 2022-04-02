import detectIndent from 'detect-indent';
import { logger } from '../../../logger';
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
