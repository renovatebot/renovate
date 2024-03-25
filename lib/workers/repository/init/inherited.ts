import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import { mergeChildConfig, removeGlobalConfig } from '../../../config';
import { parseFileConfig } from '../../../config/parse';
import type { RenovateConfig } from '../../../config/types';
import { validateConfig } from '../../../config/validation';
import {
  CONFIG_INHERIT_NOT_FOUND,
  CONFIG_INHERIT_PARSE_ERROR,
  CONFIG_VALIDATION,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import * as template from '../../../util/template';

export async function mergeInheritedConfig(
  config: RenovateConfig,
): Promise<RenovateConfig> {
  // typescript doesn't know that repo is defined
  if (!config.repository || !config.inheritConfig) {
    return config;
  }
  if (
    !is.string(config.inheritConfigRepoName) ||
    !is.string(config.inheritConfigFileName)
  ) {
    // Config validation should prevent this error
    logger.error(
      {
        inheritConfigRepoName: config.inheritConfigRepoName,
        inheritConfigFileName: config.inheritConfigFileName,
      },
      'Invalid inherited config.',
    );
    return config;
  }
  const templateConfig = {
    topLevelOrg: config.topLevelOrg,
    parentOrg: config.parentOrg,
    repository: config.repository,
  };
  const inheritConfigRepoName = template.compile(
    config.inheritConfigRepoName,
    templateConfig,
    false,
  );
  logger.trace(
    { templateConfig, inheritConfigRepoName },
    'Compiled inheritConfigRepoName result.',
  );
  logger.debug(
    `Checking for inherited config file ${config.inheritConfigFileName} in repo ${inheritConfigRepoName}.`,
  );
  let configFileRaw: string | null = null;
  try {
    configFileRaw = await platform.getRawFile(
      config.inheritConfigFileName,
      inheritConfigRepoName,
    );
  } catch (err) {
    if (config.inheritConfigStrict) {
      logger.debug({ err }, 'Error getting inherited config.');
      throw new Error(CONFIG_INHERIT_NOT_FOUND);
    }
    logger.trace({ err }, `Error getting inherited config.`);
  }
  if (!configFileRaw) {
    logger.debug(`No inherited config found in ${inheritConfigRepoName}.`);
    return config;
  }
  const parseResult = parseFileConfig(
    config.inheritConfigFileName,
    configFileRaw,
  );
  if (!parseResult.success) {
    logger.debug({ parseResult }, 'Error parsing inherited config.');
    throw new Error(CONFIG_INHERIT_PARSE_ERROR);
  }
  const inheritedConfig = parseResult.parsedContents as RenovateConfig;
  logger.debug({ config: inheritedConfig }, `Inherited config`);
  const res = await validateConfig('inherit', inheritedConfig);
  if (res.errors.length) {
    logger.warn(
      { errors: res.errors },
      'Found errors in inherited configuration.',
    );
    throw new Error(CONFIG_VALIDATION);
  }
  if (res.warnings.length) {
    logger.warn(
      { warnings: res.warnings },
      'Found warnings in inherited configuration.',
    );
  }
  const filteredConfig = removeGlobalConfig(inheritedConfig, true);
  if (!dequal(inheritedConfig, filteredConfig)) {
    logger.debug(
      { inheritedConfig, filteredConfig },
      'Removed global config from inherited config.',
    );
  }
  return mergeChildConfig(config, filteredConfig);
}
