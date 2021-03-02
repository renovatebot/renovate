import upath from 'upath';
import { logger } from '../logger';
import { GlobalConfig } from './types';
import { migrateConfig } from './migration';

export function getConfig(env: NodeJS.ProcessEnv): GlobalConfig {
  let configFile = env.RENOVATE_CONFIG_FILE || 'config';
  if (!upath.isAbsolute(configFile)) {
    configFile = `${process.cwd()}/${configFile}`;
    logger.debug('Checking for config file in ' + configFile);
  }
  let config: GlobalConfig = {};
  try {
    // eslint-disable-next-line global-require,import/no-dynamic-require
    config = require(configFile);
  } catch (err) {
    /* c8 ignore next 4 */
    if (err instanceof SyntaxError) {
      logger.fatal(`Could not parse config file \n ${err.stack}`);
      process.exit(1);
    }
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
