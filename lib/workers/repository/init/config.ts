import path from 'path';
import jsonValidator from 'json-dup-key-validator';
import JSON5 from 'json5';

import { RenovateConfig, mergeChildConfig } from '../../../config';
import { configFileNames } from '../../../config/app-strings';
import { decryptConfig } from '../../../config/decrypt';
import { migrateAndValidate } from '../../../config/migrate-validate';
import * as presets from '../../../config/presets';
import { CONFIG_VALIDATION } from '../../../constants/error-messages';
import * as npmApi from '../../../datasource/npm';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { getCache } from '../../../util/cache/repository';
import { clone } from '../../../util/clone';
import { readLocalFile } from '../../../util/fs';
import { getFileList } from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
import { flattenPackageRules } from './flatten';

// Check for repository config
export async function mergeRenovateConfig(
  config: RenovateConfig
): Promise<RenovateConfig> {
  let returnConfig = { ...config };
  const fileList = await getFileList();
  async function detectConfigFile(): Promise<string | null> {
    for (const fileName of configFileNames) {
      if (fileName === 'package.json') {
        try {
          const pJson = JSON.parse(await readLocalFile('package.json', 'utf8'));
          if (pJson.renovate) {
            logger.debug('Using package.json for global renovate config');
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
    renovateJson = JSON.parse(await readLocalFile('package.json', 'utf8'))
      .renovate;
    logger.debug({ config: renovateJson }, 'package.json>renovate config');
  } else {
    let renovateConfig = await readLocalFile(configFile, 'utf8');
    // istanbul ignore if
    if (renovateConfig === null) {
      logger.warn('Fetching renovate config returns null');
      throw new ExternalHostError(
        Error('Fetching renovate config returns null'),
        config.platform
      );
    }
    // istanbul ignore if
    if (!renovateConfig.length) {
      renovateConfig = '{}';
    }

    const fileType = path.extname(configFile);

    if (fileType === '.json5') {
      try {
        renovateJson = JSON5.parse(renovateConfig);
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { renovateConfig },
          'Error parsing renovate config renovate.json5'
        );
        const error = new Error(CONFIG_VALIDATION);
        error.configFile = configFile;
        error.validationError = 'Invalid JSON5 (parsing failed)';
        error.validationMessage = `JSON5.parse error:  ${err.message}`;
        throw error;
      }
    } else {
      let allowDuplicateKeys = true;
      let jsonValidationError = jsonValidator.validate(
        renovateConfig,
        allowDuplicateKeys
      );
      if (jsonValidationError) {
        const error = new Error(CONFIG_VALIDATION);
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
        const error = new Error(CONFIG_VALIDATION);
        error.configFile = configFile;
        error.validationError = 'Duplicate keys in JSON';
        error.validationMessage = JSON.stringify(jsonValidationError);
        throw error;
      }
      try {
        renovateJson = JSON.parse(renovateConfig);
      } catch (err) /* istanbul ignore next */ {
        logger.debug({ renovateConfig }, 'Error parsing renovate config');
        const error = new Error(CONFIG_VALIDATION);
        error.configFile = configFile;
        error.validationError = 'Invalid JSON (parsing failed)';
        error.validationMessage = `JSON.parse error:  ${err.message}`;
        throw error;
      }
    }
    logger.debug({ configFile, config: renovateJson }, 'Repository config');
  }
  const cache = getCache();
  cache.init = {
    configFile,
    contents: clone(renovateJson),
  };
  const migratedConfig = await migrateAndValidate(config, renovateJson);
  if (migratedConfig.errors.length) {
    const error = new Error(CONFIG_VALIDATION);
    error.configFile = configFile;
    error.validationError =
      'The renovate configuration file contains some invalid settings';
    error.validationMessage = migratedConfig.errors
      .map((e) => e.message)
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
    await presets.resolveConfigPresets(decryptedConfig, config),
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
    logger.debug('Setting hostRules from config');
    for (const rule of resolvedConfig.hostRules) {
      try {
        hostRules.add(rule);
      } catch (err) {
        logger.warn(
          { err, config: rule },
          'Error setting hostRule from config'
        );
      }
    }
    delete resolvedConfig.hostRules;
  }
  returnConfig = mergeChildConfig(returnConfig, resolvedConfig);
  returnConfig.renovateJsonPresent = true;
  returnConfig.packageRules = flattenPackageRules(returnConfig.packageRules);
  // istanbul ignore if
  if (returnConfig.ignorePaths && returnConfig.ignorePaths.length) {
    logger.debug(
      { ignorePaths: returnConfig.ignorePaths },
      `Found repo ignorePaths`
    );
  }
  return returnConfig;
}
