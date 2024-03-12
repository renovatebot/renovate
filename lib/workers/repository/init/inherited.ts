import is from '@sindresorhus/is';
import { mergeChildConfig } from '../../../config';
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
  if (!config.inheritConfig) {
    return config;
  }
  if (
    !is.string(config.inheritConfigRepoName) ||
    !is.string(config.inheritConfigFileName)
  ) {
    // Should not happen due to config validation
    logger.error(
      {
        inheritConfigRepoName: config.inheritConfigRepoName,
        inheritConfigFileName: config.inheritConfigFileName,
      },
      'Invalid inherited config',
    );
    return config;
  }
  const templateConfig = {
    topLevelOrg: config.repository?.split('/')[0],
    parentOrg: config.repository?.split('/').slice(0, -1).join('/'),
    repostiory: config.repository,
  };
  const inheritConfigRepoName = template.compile(
    config.inheritConfigRepoName,
    templateConfig,
    false,
  );
  logger.trace(
    { templateConfig, inheritConfigRepoName },
    'Compiled inheritConfigRepoName result',
  );
  logger.debug(
    `Checking for inherited config file ${config.inheritConfigFileName} in repo ${inheritConfigRepoName}`,
  );
  let configFileRaw: string | null = null;
  try {
    configFileRaw = await platform.getRawFile(
      config.inheritConfigFileName,
      inheritConfigRepoName,
    );
  } catch (err) {
    if (config.inheritConfigStrict) {
      logger.debug({ err }, 'Error getting inherited config');
      throw new Error(CONFIG_INHERIT_NOT_FOUND);
    }
    logger.trace({ err }, `Error getting inherited config`);
  }
  if (!configFileRaw) {
    logger.debug(`No inherited config found in ${inheritConfigRepoName}`);
    return config;
  }
  const parseResult = parseFileConfig(
    config.inheritConfigFileName,
    configFileRaw,
  );
  if (!parseResult.success) {
    logger.debug({ parseResult }, 'Error parsing inherited config');
    throw new Error(CONFIG_INHERIT_PARSE_ERROR);
  }
  const inheritedConfig = parseResult.parsedContents as RenovateConfig;
  logger.debug({ config: inheritedConfig }, `Inherited config`);
  const res = await validateConfig('inherit', inheritedConfig);
  if (res.errors.length) {
    logger.warn(
      { errors: res.errors },
      'Found errors in inherited configuration',
    );
    throw new Error(CONFIG_VALIDATION);
  }
  if (res.warnings.length) {
    logger.warn(
      { warnings: res.warnings },
      'Found warnings in inherited configuration',
    );
  }
  return mergeChildConfig(config, inheritedConfig);
}
