import os from 'node:os';
import is from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../logger';
import { readSystemFile } from '../../../util/fs';
import type { GlobalManagerConfig } from '../types';

export async function detectGlobalConfig(): Promise<GlobalManagerConfig> {
  const res: GlobalManagerConfig = {};
  const homedir = os.homedir();
  const settingsFileName = upath.join(homedir, '.m2', 'settings.xml');
  try {
    const settings = await readSystemFile(settingsFileName, 'utf8');
    if (is.nonEmptyString(settings)) {
      res.mavenSettings = settings;
      res.mavenSettingsMerge = true;
      logger.debug(
        `Detected ${settingsFileName} and adding it to global config`,
      );
    }
  } catch {
    logger.warn({ settingsFileName }, 'Error reading .m2/settings.xml file');
  }
  return res;
}
