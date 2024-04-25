import os from 'node:os';
import is from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger';
import { readSystemFile } from '../../../util/fs';
import type { GlobalManagerConfig } from '../types';

export async function detectGlobalConfig(): Promise<GlobalManagerConfig> {
  const res: GlobalManagerConfig = {};
  const homedir = os.homedir();
  const npmrcFileName = upath.join(homedir, '.npmrc');
  try {
    const npmrc = await readSystemFile(npmrcFileName, 'utf8');
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
