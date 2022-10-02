import is from '@sindresorhus/is';
import jsonValidator from 'json-dup-key-validator';
import JSON5 from 'json5';
import upath from 'upath';
import { mergeChildConfig } from '../../../config';
import { configFileNames } from '../../../config/app-strings';
import { decryptConfig } from '../../../config/decrypt';
import { migrateAndValidate } from '../../../config/migrate-validate';
import { migrateConfig } from '../../../config/migration';
import * as presets from '../../../config/presets';
import { applySecretsToConfig } from '../../../config/secrets';
import type { RenovateConfig } from '../../../config/types';
import {
  CONFIG_VALIDATION,
  REPOSITORY_CHANGED,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import * as npmApi from '../../../modules/datasource/npm';
import { platform } from '../../../modules/platform';
import { getCache } from '../../../util/cache/repository';
import { readLocalFile } from '../../../util/fs';
import { getFileList } from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
import * as queue from '../../../util/http/queue';
import type { RepoFileConfig } from './types';

async function detectConfigFile(): Promise<string | null> {
  const fileList = await getFileList();
  for (const fileName of configFileNames) {
    if (fileName === 'package.json') {
      try {
        const pJson = JSON.parse(
          (await readLocalFile('package.json', 'utf8'))!
        );
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

export async function detectRepoFileConfig(): Promise<RepoFileConfig> {
  const cache = getCache();
  let { configFileName } = cache;
  if (configFileName) {
    const configFileRaw = await platform.getRawFile(configFileName);
    if (configFileRaw) {
      let configFileParsed = JSON5.parse(configFileRaw);
      if (configFileName !== 'package.json') {
        return { configFileName, configFileRaw, configFileParsed };
      }
      configFileParsed = configFileParsed.renovate;
      return { configFileName, configFileParsed }; // don't return raw 'package.json'
    } else {
      logger.debug('Existing config file no longer exists');
    }
  }
  configFileName = (await detectConfigFile()) ?? undefined;
  if (!configFileName) {
    logger.debug('No renovate config file found');
    return {};
  }
  cache.configFileName = configFileName;
  logger.debug(`Found ${configFileName} config file`);
  // TODO #7154
  let configFileParsed: any;
  let configFileRaw: string | undefined | null;
  if (configFileName === 'package.json') {
    // We already know it parses
    configFileParsed = JSON.parse(
      // TODO #7154
      (await readLocalFile('package.json', 'utf8'))!
    ).renovate;
    if (is.string(configFileParsed)) {
      logger.debug('Massaging string renovate config to extends array');
      configFileParsed = { extends: [configFileParsed] };
    }
    logger.debug({ config: configFileParsed }, 'package.json>renovate config');
  } else {
    configFileRaw = await readLocalFile(configFileName, 'utf8');
    // istanbul ignore if
    if (!is.string(configFileRaw)) {
      logger.warn({ configFileName }, 'Null contents when reading config file');
      throw new Error(REPOSITORY_CHANGED);
    }
    // istanbul ignore if
    if (!configFileRaw.length) {
      configFileRaw = '{}';
    }

    const fileType = upath.extname(configFileName);

    if (fileType === '.json5') {
      try {
        configFileParsed = JSON5.parse(configFileRaw);
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { renovateConfig: configFileRaw },
          'Error parsing renovate config renovate.json5'
        );
        const validationError = 'Invalid JSON5 (parsing failed)';
        const validationMessage = `JSON5.parse error:  ${String(err.message)}`;
        return {
          configFileName,
          configFileParseError: { validationError, validationMessage },
        };
      }
    } else {
      let allowDuplicateKeys = true;
      let jsonValidationError = jsonValidator.validate(
        configFileRaw,
        allowDuplicateKeys
      );
      if (jsonValidationError) {
        const validationError = 'Invalid JSON (parsing failed)';
        const validationMessage = jsonValidationError;
        return {
          configFileName,
          configFileParseError: { validationError, validationMessage },
        };
      }
      allowDuplicateKeys = false;
      jsonValidationError = jsonValidator.validate(
        configFileRaw,
        allowDuplicateKeys
      );
      if (jsonValidationError) {
        const validationError = 'Duplicate keys in JSON';
        const validationMessage = JSON.stringify(jsonValidationError);
        return {
          configFileName,
          configFileParseError: { validationError, validationMessage },
        };
      }
      try {
        configFileParsed = JSON5.parse(configFileRaw);
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { renovateConfig: configFileRaw },
          'Error parsing renovate config'
        );
        const validationError = 'Invalid JSON (parsing failed)';
        const validationMessage = `JSON.parse error:  ${String(err.message)}`;
        return {
          configFileName,
          configFileParseError: { validationError, validationMessage },
        };
      }
    }
    logger.debug(
      { fileName: configFileName, config: configFileParsed },
      'Repository config'
    );
  }
  return { configFileName, configFileRaw, configFileParsed };
}

export function checkForRepoConfigError(repoConfig: RepoFileConfig): void {
  if (!repoConfig.configFileParseError) {
    return;
  }
  const error = new Error(CONFIG_VALIDATION);
  error.validationSource = repoConfig.configFileName;
  error.validationError = repoConfig.configFileParseError.validationError;
  error.validationMessage = repoConfig.configFileParseError.validationMessage;
  throw error;
}

// Check for repository config
export async function mergeRenovateConfig(
  config: RenovateConfig
): Promise<RenovateConfig> {
  let returnConfig = { ...config };
  let repoConfig: RepoFileConfig = {};
  if (config.requireConfig !== 'ignored') {
    repoConfig = await detectRepoFileConfig();
  }
  const configFileParsed = repoConfig?.configFileParsed || {};
  if (is.nonEmptyArray(returnConfig.extends)) {
    configFileParsed.extends = [
      ...returnConfig.extends,
      ...(configFileParsed.extends || []),
    ];
    delete returnConfig.extends;
  }
  checkForRepoConfigError(repoConfig);
  const migratedConfig = await migrateAndValidate(config, configFileParsed);
  if (migratedConfig.errors?.length) {
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = repoConfig.configFileName;
    error.validationError =
      'The renovate configuration file contains some invalid settings';
    error.validationMessage = migratedConfig.errors
      .map((e) => e.message)
      .join(', ');
    throw error;
  }
  if (migratedConfig.warnings) {
    returnConfig.warnings = [
      ...(returnConfig.warnings ?? []),
      ...migratedConfig.warnings,
    ];
  }
  delete migratedConfig.errors;
  delete migratedConfig.warnings;
  logger.debug({ config: migratedConfig }, 'migrated config');
  // TODO #7154
  const repository = config.repository!;
  // Decrypt before resolving in case we need npm authentication for any presets
  const decryptedConfig = await decryptConfig(migratedConfig, repository);
  // istanbul ignore if
  if (is.string(decryptedConfig.npmrc)) {
    logger.debug('Found npmrc in decrypted config - setting');
    npmApi.setNpmrc(decryptedConfig.npmrc);
  }
  // Decrypt after resolving in case the preset contains npm authentication instead
  let resolvedConfig = await decryptConfig(
    await presets.resolveConfigPresets(decryptedConfig, config),
    repository
  );
  logger.trace({ config: resolvedConfig }, 'resolved config');
  const migrationResult = migrateConfig(resolvedConfig);
  if (migrationResult.isMigrated) {
    logger.debug('Resolved config needs migrating');
    logger.trace({ config: resolvedConfig }, 'resolved config after migrating');
    resolvedConfig = migrationResult.migratedConfig;
  }
  // istanbul ignore if
  if (is.string(resolvedConfig.npmrc)) {
    logger.debug(
      'Ignoring any .npmrc files in repository due to configured npmrc'
    );
    npmApi.setNpmrc(resolvedConfig.npmrc);
  }
  resolvedConfig = applySecretsToConfig(
    resolvedConfig,
    mergeChildConfig(config.secrets ?? {}, resolvedConfig.secrets ?? {})
  );
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
    // host rules can change concurrency
    queue.clear();
    delete resolvedConfig.hostRules;
  }
  returnConfig = mergeChildConfig(returnConfig, resolvedConfig);
  returnConfig = await presets.resolveConfigPresets(returnConfig, config);
  returnConfig.renovateJsonPresent = true;
  // istanbul ignore if
  if (returnConfig.ignorePaths?.length) {
    logger.debug(
      { ignorePaths: returnConfig.ignorePaths },
      `Found repo ignorePaths`
    );
  }
  return returnConfig;
}
