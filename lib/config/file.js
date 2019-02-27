const path = require('path');
const { migrateConfig } = require('./migration');

module.exports = {
  getConfig,
};

function getConfig(env) {
  let configFile = env.RENOVATE_CONFIG_FILE || 'config';
  if (!path.isAbsolute(configFile)) {
    configFile = `${process.cwd()}/${configFile}`;
  }
  let config = {};
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
