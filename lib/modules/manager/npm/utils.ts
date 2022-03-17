import detectIndent from 'detect-indent';
import { logger } from '../../../logger';
import type { ParseLockFileResult } from './types';

export function parseLockFile(lockFile: string): ParseLockFileResult {
  const detectedIndent: string = detectIndent(lockFile).indent || '  ';

  let lockFileParsed: any;
  try {
    lockFileParsed = JSON.parse(lockFile);
  } catch (err) {
    logger.warn({ err }, 'Error parsing npm lock file');
  }

  return { detectedIndent, lockFileParsed };
}

export function composeLockFile(lockFile: any, detectedIndent: string): string {
  return JSON.stringify(lockFile, null, detectedIndent);
}
