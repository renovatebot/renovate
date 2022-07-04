import os from 'os';
import is from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger';
import { readSystemFile } from '../../../util/fs';
import { convertYarnrcYmlToNpmrc } from '../../datasource/npm/yarnrc';
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

  const yarnrcYmlFileName = upath.join(homedir, '.yarnrc.yml');
  try {
    const yarnrcYml = await readSystemFile(yarnrcYmlFileName, 'utf8');
    if (is.nonEmptyString(yarnrcYml)) {
      res.npmrc = convertYarnrcYmlToNpmrc(yarnrcYml);
      res.npmrcMerge = true;
      logger.debug(
        `Detected ${yarnrcYmlFileName} and adding it to global config`
      );
    }
  } catch (err) {
    logger.warn({ yarnrcYmlFileName }, 'Error reading .yarnrc.yml file');
  }

  return res;
}
