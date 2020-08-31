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
import { getCache } from '../../../util/cache/repository';
import { readLocalFile } from '../../../util/fs';
import { checkoutBranch, getFileList } from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
import { checkOnboardingBranch } from '../onboarding/branch';
import { RepoConfig } from './common';
import { flattenPackageRules } from './flatten';
import { detectSemanticCommits } from './semantic';

export async function detectRepoFileConfig(): Promise<RepoConfig> {
  const fileList = await getFileList();
  async function detectConfigFile(): Promise<string | null> {
    for (const configFileName of configFileNames) {
      if (configFileName === 'package.json') {
        try {
          const pJson = JSON.parse(await readLocalFile('package.json', 'utf8'));
          if (pJson.renovate) {
            logger.debug('Using package.json for global renovate config');
            return 'package.json';
          }
        } catch (err) {
          // Do nothing
        }
      } else if (fileList.includes(configFileName)) {
        return configFileName;
      }
    }
    return null;
  }
  const fileName = await detectConfigFile();
  if (!fileName) {
    logger.debug('No renovate config file found');
    return {};
  }
  logger.debug(`Found ${fileName} config file`);
  let config;
  if (fileName === 'package.json') {
    // We already know it parses
    config = JSON.parse(await readLocalFile('package.json', 'utf8')).renovate;
    logger.debug({ config }, 'package.json>renovate config');
  } else {
    let rawFileContents = await readLocalFile(fileName, 'utf8');
    // istanbul ignore if
    if (!rawFileContents.length) {
      rawFileContents = '{}';
    }

    const fileType = path.extname(fileName);

    if (fileType === '.json5') {
      try {
        config = JSON5.parse(rawFileContents);
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { renovateConfig: rawFileContents },
          'Error parsing renovate config renovate.json5'
        );
        const validationError = 'Invalid JSON5 (parsing failed)';
        const validationMessage = `JSON5.parse error:  ${String(err.message)}`;
        return { fileName, error: { validationError, validationMessage } };
      }
    } else {
      let allowDuplicateKeys = true;
      let jsonValidationError = jsonValidator.validate(
        rawFileContents,
        allowDuplicateKeys
      );
      if (jsonValidationError) {
        const validationError = 'Invalid JSON (parsing failed)';
        const validationMessage = jsonValidationError;
        return { fileName, error: { validationError, validationMessage } };
      }
      allowDuplicateKeys = false;
      jsonValidationError = jsonValidator.validate(
        rawFileContents,
        allowDuplicateKeys
      );
      if (jsonValidationError) {
        const validationError = 'Duplicate keys in JSON';
        const validationMessage = JSON.stringify(jsonValidationError);
        return { fileName, error: { validationError, validationMessage } };
      }
      try {
        config = JSON.parse(rawFileContents);
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { renovateConfig: rawFileContents },
          'Error parsing renovate config'
        );
        const validationError = 'Invalid JSON (parsing failed)';
        const validationMessage = `JSON.parse error:  ${String(err.message)}`;
        return { fileName, error: { validationError, validationMessage } };
      }
    }
    logger.debug({ fileName, config }, 'Repository config');
  }
  return { fileName, config };
}

function checkForRepoConfigError(repoConfig: RepoConfig): void {
  if (!repoConfig.error) {
    return;
  }
  const error = new Error(CONFIG_VALIDATION);
  error.configFile = repoConfig.fileName;
  error.validationError = repoConfig.error.validationError;
  error.validationMessage = repoConfig.error.validationMessage;
  throw error;
}

// Check for repository config
export async function mergeRenovateConfig(
  config: RenovateConfig
): Promise<RenovateConfig> {
  let returnConfig = { ...config };
  const repoConfig = await detectRepoFileConfig();
  const cache = getCache();
  cache.init.repoConfig = repoConfig;
  checkForRepoConfigError(repoConfig);
  const migratedConfig = await migrateAndValidate(
    config,
    repoConfig?.config || {}
  );
  if (migratedConfig.errors.length) {
    const error = new Error(CONFIG_VALIDATION);
    error.configFile = repoConfig.fileName;
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
  if (returnConfig.ignorePaths?.length) {
    logger.debug(
      { ignorePaths: returnConfig.ignorePaths },
      `Found repo ignorePaths`
    );
  }
  return returnConfig;
}

// istanbul ignore next
export async function getRepoConfig(
  config_: RenovateConfig
): Promise<RenovateConfig> {
  let config = { ...config_ };
  config.baseBranch = config.defaultBranch;
  config.baseBranchSha = await checkoutBranch(config.baseBranch);
  config.semanticCommits = await detectSemanticCommits(config);
  config = await checkOnboardingBranch(config);
  config = await mergeRenovateConfig(config);
  return config;
}
