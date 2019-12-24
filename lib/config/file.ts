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
    if (err instanceof SyntaxError) {
      // extract first line of error stack message
      const errorStackMessage = err.stack.split('\n')[0];
      const file = errorStackMessage.split(':')[0];
      const line = errorStackMessage.split(':')[1];
      logger.fatal({ file, line }, err.message);
    } else {
      logger.debug('No config file found on disk - skipping');
    }
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
