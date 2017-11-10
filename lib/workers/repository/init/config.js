const jsonValidator = require('json-dup-key-validator');

const { mergeChildConfig } = require('../../../config');
const { migrateAndValidate } = require('../../../config/migrate-validate');
const { decryptConfig } = require('../../../config/decrypt');
const presets = require('../../../config/presets');

// Check for config in `renovate.json`
async function mergeRenovateConfig(config) {
  let returnConfig = { ...config };
  const fileList = await platform.getFileList();
  let configFile;
  if (fileList.includes('renovate.json')) {
    configFile = 'renovate.json';
  } else if (fileList.includes('.renovaterc')) {
    configFile = '.renovaterc';
  } else if (fileList.includes('.renovaterc.json')) {
    configFile = '.renovaterc.json';
  }
  if (!configFile) {
    logger.debug('No renovate config file found');
    return returnConfig;
  }
  logger.debug(`Found ${configFile} config file`);
  const renovateConfig = await platform.getFile(configFile);
  let allowDuplicateKeys = true;
  let jsonValidationError = jsonValidator.validate(
    renovateConfig,
    allowDuplicateKeys
  );
  if (jsonValidationError) {
    const error = {
      depName: configFile,
      message: jsonValidationError,
    };
    logger.warn(error.message);
    returnConfig.errors.push(error);
    // Return unless error can be ignored
    return returnConfig;
  }
  allowDuplicateKeys = false;
  jsonValidationError = jsonValidator.validate(
    renovateConfig,
    allowDuplicateKeys
  );
  if (jsonValidationError) {
    const error = {
      depName: configFile,
      message: jsonValidationError,
    };
    logger.warn(error.message);
    returnConfig.errors.push(error);
    // Return unless error can be ignored
  }
  const renovateJson = JSON.parse(renovateConfig);
  logger.debug({ config: renovateJson }, 'renovate.json config');
  const migratedConfig = migrateAndValidate(config, renovateJson);
  logger.debug({ config: migratedConfig }, 'renovate.json migrated config');
  const decryptedConfig = decryptConfig(migratedConfig, config.privateKey);
  const resolvedConfig = await presets.resolveConfigPresets(decryptedConfig);
  logger.trace({ config: resolvedConfig }, 'renovate.json resolved config');
  returnConfig = mergeChildConfig(returnConfig, resolvedConfig);
  returnConfig.renovateJsonPresent = true;
  return returnConfig;
}

module.exports = {
  mergeRenovateConfig,
};
