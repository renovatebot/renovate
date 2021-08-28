import upath from 'upath';
import { migrateConfig } from '../../../../config/migration';
import type { AllConfig } from '../../../../config/types';
import { logger } from '../../../../logger';

export function getConfig(env: NodeJS.ProcessEnv): AllConfig {
  let configFile = env.RENOVATE_CONFIG_FILE || 'config';
  if (!upath.isAbsolute(configFile)) {
    configFile = `${process.cwd()}/${configFile}`;
    logger.debug('Checking for config file in ' + configFile);
  }
  let config: AllConfig = {};
  try {
    // eslint-disable-next-line global-require,import/no-dynamic-require
    config = require(configFile);
  } catch (err) {
    // istanbul ignore if
    if (
      err instanceof SyntaxError ||
      err.name === 'SyntaxError' ||
      err instanceof TypeError
    ) {
      logger.fatal(`Could not parse config file \n ${err.stack}`);
    } else {
      logger.fatal('No config file found on disk - skipping');
    }

    process.exit(1);
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
