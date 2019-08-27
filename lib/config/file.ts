import path from 'path';
import { logger } from '../logger';
import { migrateConfig } from './migration';
import { RenovateConfig } from './common';

export function getConfig(env: NodeJS.ProcessEnv): RenovateConfig {
  let configFile = env.RENOVATE_CONFIG_FILE || 'config';
  if (!path.isAbsolute(configFile)) {
    configFile = `${process.cwd()}/${configFile}`;
    logger.debug('Checking for config file in ' + configFile);
  }
  let config: RenovateConfig = {};
  try {
    // eslint-disable-next-line global-require,import/no-dynamic-require
    config = require(configFile);
  } catch (err) {
    // Do nothing
    logger.debug('No config file found on disk - skipping');
  }
  const { isMigrated, migratedConfig } = migrateConfig(config);
  if (isMigrated) {
    logger.warn(
      { originalConfig: config, migratedConfig },
      'Config needs migrating'
    );
    config = migratedConfig;
  }
  return config;
}
