import os from 'os';
import is from '@sindresorhus/is';
import { join } from 'upath';
import { logger } from '../../logger';
import { readLocalFile } from '../../util/fs';
import { GlobalManagerConfig } from '../types';

export async function detectGlobalConfig(): Promise<GlobalManagerConfig> {
  const res: GlobalManagerConfig = {};
  const npmrcFileName = '.npmrc';
  try {
    const npmrc = await readLocalFile(npmrcFileName, 'utf8');
    if (is.nonEmptyString(npmrc)) {
      res.npmrc = npmrc;
      res.npmrcMerge = true;
      logger.debug(`Detected ${npmrcFileName} and adding it to global config`);
    }
  } catch (err) {
    logger.warn({ npmrcFileName }, 'Error reading .npmrc file');
  }
  return res;
}
