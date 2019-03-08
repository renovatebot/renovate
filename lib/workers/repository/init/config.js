const jsonValidator = require('json-dup-key-validator');

const { mergeChildConfig } = require('../../../config');
const { migrateAndValidate } = require('../../../config/migrate-validate');
const { decryptConfig } = require('../../../config/decrypt');
const presets = require('../../../config/presets');
const npmApi = require('../../../datasource/npm');
const { flattenPackageRules } = require('./flatten');
const hostRules = require('../../../util/host-rules');
const { configFileNames } = require('../../../config/app-strings');

// Check for repository config
async function mergeRenovateConfig(config) {
  let returnConfig = { ...config };
  const fileList = await platform.getFileList();
  async function detectConfigFile() {
    for (const fileName of configFileNames) {
      if (fileName === 'package.json') {
        try {
          const pJson = JSON.parse(await platform.getFile('package.json'));
          if (pJson.renovate) {
            logger.info('Using package.json for global renovate config');
            return 'package.json';
          }
        } catch (err) {
          // Do nothing
        }
      } else if (fileList.includes(fileName)) {
        return fileName;
      }
    }
    return null;
  }
  const configFile = await detectConfigFile();
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
    let renovateConfig = await platform.getFile(configFile);
    // istanbul ignore if
    if (renovateConfig === null) {
      logger.warn('Fetching renovate config returns null');
      throw new Error('registry-failure');
    }
    // istanbul ignore if
    if (!renovateConfig.length) {
      renovateConfig = '{}';
    }
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
    try {
      renovateJson = JSON.parse(renovateConfig);
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ renovateConfig }, 'Error parsing renovate config');
      const error = new Error('config-validation');
      error.configFile = configFile;
      error.validationError = 'Invalid JSON (parsing failed)';
      error.validationMessage = 'JSON.parse error: ' + err.message;
      throw error;
    }
    logger.info({ configFile, config: renovateJson }, 'Repository config');
  }
  const migratedConfig = await migrateAndValidate(config, renovateJson);
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
  if (migratedConfig.warnings) {
    returnConfig.warnings = returnConfig.warnings.concat(
      migratedConfig.warnings
    );
  }
  delete migratedConfig.errors;
  delete migratedConfig.warnings;
  logger.debug({ config: migratedConfig }, 'migrated config');
  // Decrypt before resolving in case we need npm authentication for any presets
  const decryptedConfig = decryptConfig(migratedConfig, config.privateKey);
  // istanbul ignore if
  if (decryptedConfig.npmrc) {
    logger.debug('Found npmrc in decrypted config - setting');
    npmApi.setNpmrc(decryptedConfig.npmrc);
  }
  // Decrypt after resolving in case the preset contains npm authentication instead
  const resolvedConfig = decryptConfig(
    await presets.resolveConfigPresets(decryptedConfig),
    config.privateKey
  );
  delete resolvedConfig.privateKey;
  logger.trace({ config: resolvedConfig }, 'resolved config');
  // istanbul ignore if
  if (resolvedConfig.npmrc) {
    logger.debug(
      'Ignoring any .npmrc files in repository due to configured npmrc'
    );
    npmApi.setNpmrc(resolvedConfig.npmrc);
    resolvedConfig.ignoreNpmrcFile = true;
  }
  // istanbul ignore if
  if (resolvedConfig.hostRules) {
    logger.info('Setting hostRules from config');
    resolvedConfig.hostRules.forEach(hostRules.update);
    delete resolvedConfig.hostRules;
  }
  returnConfig = mergeChildConfig(returnConfig, resolvedConfig);
  returnConfig.renovateJsonPresent = true;
  returnConfig.packageRules = flattenPackageRules(returnConfig.packageRules);
  return returnConfig;
}

module.exports = {
  mergeRenovateConfig,
};
