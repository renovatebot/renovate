const configMigration = require('./migration');
const configMassage = require('./massage');
const configValidation = require('./validation');

module.exports = {
  migrateAndValidate,
};

function migrateAndValidate(config, input) {
  const { logger } = config;
  const { isMigrated, migratedConfig } = configMigration.migrateConfig(input);
  if (isMigrated) {
    logger.info(
      { oldConfig: input, newConfig: migratedConfig },
      'Config migration necessary'
    );
  }
  const massagedConfig = configMassage.massageConfig(migratedConfig);
  const { warnings, errors } = configValidation.validateConfig(massagedConfig);
  // istanbul ignore if
  if (warnings.length) {
    logger.debug({ warnings }, 'Found renovate config warnings');
  }
  if (errors.length) {
    logger.warn({ errors }, 'Found renovate config errors');
  }
  if (!config.repoIsOnboarded) {
    // TODO #556 - enable warnings in real PRs
    massagedConfig.warnings = (config.warnings || []).concat(warnings);
    massagedConfig.errors = (config.errors || []).concat(errors);
  }
  return massagedConfig;
}
