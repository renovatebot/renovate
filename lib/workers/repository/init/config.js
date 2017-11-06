const jsonValidator = require('json-dup-key-validator');

const { mergeChildConfig } = require('../../../config');
const { migrateAndValidate } = require('../../../config/migrate-validate');
const { decryptConfig } = require('../../../config/decrypt');
const presets = require('../../../config/presets');

// Check for config in `renovate.json`
async function mergeRenovateJson(config) {
  const { logger } = config;
  let returnConfig = { ...config };
  const renovateJsonContent = await config.api.getFileContent('renovate.json');
  if (!renovateJsonContent) {
    logger.debug('No renovate.json found');
    return returnConfig;
  }
  logger.debug('Found renovate.json file');
  let allowDuplicateKeys = true;
  let jsonValidationError = jsonValidator.validate(
    renovateJsonContent,
    allowDuplicateKeys
  );
  if (jsonValidationError) {
    const error = {
      depName: 'renovate.json',
      message: jsonValidationError,
    };
    logger.warn(error.message);
    returnConfig.errors.push(error);
    // Return unless error can be ignored
    return returnConfig;
  }
  allowDuplicateKeys = false;
  jsonValidationError = jsonValidator.validate(
    renovateJsonContent,
    allowDuplicateKeys
  );
  if (jsonValidationError) {
    const error = {
      depName: 'renovate.json',
      message: jsonValidationError,
    };
    logger.warn(error.message);
    returnConfig.errors.push(error);
    // Return unless error can be ignored
  }
  const renovateJson = JSON.parse(renovateJsonContent);
  logger.debug({ config: renovateJson }, 'renovate.json config');
  const migratedConfig = migrateAndValidate(config, renovateJson);
  logger.debug({ config: migratedConfig }, 'renovate.json migrated config');
  const decryptedConfig = decryptConfig(
    migratedConfig,
    config.logger,
    config.privateKey
  );
  const resolvedConfig = await presets.resolveConfigPresets(
    decryptedConfig,
    logger
  );
  logger.trace({ config: resolvedConfig }, 'renovate.json resolved config');
  returnConfig = mergeChildConfig(returnConfig, resolvedConfig);
  returnConfig.renovateJsonPresent = true;
  return returnConfig;
}

module.exports = {
  mergeRenovateJson,
};
