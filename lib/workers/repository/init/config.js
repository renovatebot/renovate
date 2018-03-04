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
  } else if (fileList.includes('package.json')) {
    try {
      const pJson = JSON.parse(await platform.getFile('package.json'));
      if (pJson.renovate) {
        logger.info('Using package.json for global renovate config');
        configFile = 'package.json';
      }
    } catch (err) {
      // Do nothing
    }
  }
  if (!configFile) {
    logger.debug('No renovate config file found');
    return returnConfig;
  }
  logger.debug(`Found ${configFile} config file`);
  let renovateJson;
  if (configFile === 'package.json') {
    // We already know it parses
    renovateJson = JSON.parse(await platform.getFile('package.json')).renovate;
    logger.info({ config: renovateJson }, 'package.json>renovate config');
  } else {
    const renovateConfig = await platform.getFile(configFile);
    let allowDuplicateKeys = true;
    let jsonValidationError = jsonValidator.validate(
      renovateConfig,
      allowDuplicateKeys
    );
    if (jsonValidationError) {
      const error = new Error('config-validation');
      error.configFile = configFile;
      error.validationError = 'Invalid JSON (parsing failed)';
      error.validationMessage = jsonValidationError;
      throw error;
    }
    allowDuplicateKeys = false;
    jsonValidationError = jsonValidator.validate(
      renovateConfig,
      allowDuplicateKeys
    );
    if (jsonValidationError) {
      const error = new Error('config-validation');
      error.configFile = configFile;
      error.validationError = 'Duplicate keys in JSON';
      error.validationMessage = JSON.stringify(jsonValidationError);
      throw error;
    }
    renovateJson = JSON.parse(renovateConfig);
    logger.info({ config: renovateJson }, 'renovate.json config');
  }
  const migratedConfig = migrateAndValidate(config, renovateJson);
  if (migratedConfig.errors.length) {
    const error = new Error('config-validation');
    error.configFile = configFile;
    error.validationError =
      'The renovate configuration file contains some invalid settings';
    error.validationMessage = migratedConfig.errors
      .map(e => e.message)
      .join(', ');
    throw error;
  }
  delete migratedConfig.errors;
  delete migratedConfig.warnings;
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
