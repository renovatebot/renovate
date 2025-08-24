import is from '@sindresorhus/is';
import fs from 'fs-extra';
import type { AllConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { getParsedContent, migrateAndValidateConfig } from './util';

export async function getConfig(env: NodeJS.ProcessEnv): Promise<AllConfig> {
  let config: AllConfig = {};
  const configFile = env.RENOVATE_ADDITIONAL_CONFIG_FILE;
  if (!configFile) {
    logger.debug('No additional config file found specified - skipping');
    return config;
  }

  const configFileExists = await fs.pathExists(configFile);
  if (!configFileExists) {
    // Unsure what behavior is expected here
    logger.fatal(
      { configFile },
      `Custom additional config file specified in RENOVATE_ADDITIONAL_CONFIG_FILE must exist`,
    );
    process.exit(1);
  }

  logger.debug('Checking for additional config file in ' + configFile);
  try {
    config = await getParsedContent(configFile);
  } catch (err) {
    if (err instanceof SyntaxError || err instanceof TypeError) {
      // Unsure what behavior is expected here
      logger.fatal(
        { error: err.stack },
        'Could not parse additional config file',
      );
      process.exit(1);
    } else if (err instanceof ReferenceError) {
      // Unsure what behavior is expected here
      logger.fatal(
        `Error parsing additional config file due to unresolved variable(s): ${err.message}`,
      );
      process.exit(1);
    } else if (err.message === 'Unsupported file type') {
      logger.fatal(err.message);
      process.exit(1);
    } else if (env.RENOVATE_ADDITIONAL_CONFIG_FILE) {
      logger.debug({ err }, 'Parse error');
      logger.fatal('Error parsing additional config file');
      process.exit(1);
    }
    logger.debug('Error reading or parsing additional config file - skipping');
  }

  if (is.nonEmptyObject(config.processEnv)) {
    const exportedKeys = [];
    for (const [key, value] of Object.entries(config.processEnv)) {
      if (!is.nonEmptyString(value)) {
        logger.error({ key }, 'processEnv value is not a string.');
        continue;
      }

      exportedKeys.push(key);
      process.env[key] = value;
    }
    logger.debug(
      { keys: exportedKeys },
      'processEnv keys were exported to env',
    );
    delete config.processEnv;
  }

  return migrateAndValidateConfig(config, configFile);
}

export async function deleteNonDefaultConfig(
  env: NodeJS.ProcessEnv,
  deleteConfigFile: boolean,
): Promise<void> {
  const configFile = env.RENOVATE_ADDITIONAL_CONFIG_FILE;

  if (is.undefined(configFile) || is.emptyStringOrWhitespace(configFile)) {
    return;
  }

  if (!deleteConfigFile) {
    return;
  }

  if (!(await fs.pathExists(configFile))) {
    return;
  }

  try {
    await fs.remove(configFile);
    logger.trace(
      { path: configFile },
      'Additional config file successfully deleted',
    );
  } catch (err) {
    logger.warn({ err }, 'Error deleting additional config file');
  }
}
