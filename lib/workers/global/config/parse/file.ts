import { pathToFileURL } from 'url';
import is from '@sindresorhus/is';
import fs from 'fs-extra';
import JSON5 from 'json5';
import upath from 'upath';
import type { AllConfig, RenovateConfig } from '../../../../config/types';
import { logFatal, logger } from '../../../../logger';
import { parseJson } from '../../../../util/common';
import { readSystemFile } from '../../../../util/fs';
import { parseSingleYaml } from '../../../../util/yaml';
import { migrateAndValidateConfig } from './util';

export async function getParsedContent(file: string): Promise<RenovateConfig> {
  if (upath.basename(file) === '.renovaterc') {
    return JSON5.parse(await readSystemFile(file, 'utf8'));
  }
  switch (upath.extname(file)) {
    case '.yaml':
    case '.yml':
      return parseSingleYaml(await readSystemFile(file, 'utf8'));
    case '.json5':
    case '.json':
      return parseJson(
        await readSystemFile(file, 'utf8'),
        file,
      ) as RenovateConfig;
    case '.cjs':
    case '.mjs':
    case '.js': {
      const absoluteFilePath = upath.isAbsolute(file)
        ? file
        : `${process.cwd()}/${file}`;
      // use file url paths to avoid issues with windows paths
      // typescript does not support file URL for import
      const tmpConfig = await import(pathToFileURL(absoluteFilePath).href);
      /* v8 ignore next -- not testable */
      let config = tmpConfig.default ?? tmpConfig;
      // Allow the config to be a function
      if (is.function(config)) {
        config = config();
      }
      return config;
    }
    default:
      throw new Error('Unsupported file type');
  }
}

export async function getConfig(env: NodeJS.ProcessEnv): Promise<AllConfig> {
  const configFile = env.RENOVATE_CONFIG_FILE ?? 'config.js';

  const configFileExists = await fs.pathExists(configFile);
  if (env.RENOVATE_CONFIG_FILE && !configFileExists) {
    logFatal('CONFIG_FILE_NOT_FOUND', {
      fileName: configFile,
    });
    process.exit(1);
  }

  let config: AllConfig = {};

  if (!configFileExists) {
    logger.debug('No config file found on disk - skipping');
    return config;
  }

  logger.debug('Checking for config file in ' + configFile);
  try {
    config = await getParsedContent(configFile);
  } catch (err) {
    logger.debug({ err }, 'Error reading or parsing config file');
    if (err instanceof SyntaxError || err instanceof TypeError) {
      logFatal('CONFIG_FILE_PARSE_ERROR', {
        fileName: configFile,
        errorMessage: err.message,
      });
      process.exit(1);
    } else if (err instanceof ReferenceError) {
      logFatal('CONFIG_FILE_PARSE_ERROR', {
        fileName: configFile,
        errorMessage: `Error parsing config file due to unresolved variable(s): ${err.message}`,
      });
      process.exit(1);
    } else if (err.message === 'Unsupported file type') {
      logFatal('CONFIG_FILE_PARSE_ERROR', {
        fileName: configFile,
        errorMessage: err.message,
      });
      process.exit(1);
    } else if (env.RENOVATE_CONFIG_FILE) {
      logFatal('CONFIG_FILE_PARSE_ERROR', {
        fileName: configFile,
        errorMessage: err.message,
      });
      process.exit(1);
    }
    logger.debug('Error reading or parsing file - skipping');
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
  const configFile = env.RENOVATE_CONFIG_FILE;

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
    logger.trace({ path: configFile }, 'config file successfully deleted');
  } catch (err) {
    logger.warn({ err }, 'error deleting config file');
  }
}
