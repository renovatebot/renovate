import is from '@sindresorhus/is';
import fs from 'fs-extra';
import JSON5 from 'json5';
import upath from 'upath';
import type { AllConfig, RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
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
      return parseSingleYaml(await readSystemFile(file, 'utf8'), {
        json: true,
      });
    case '.json5':
    case '.json':
      return parseJson(
        await readSystemFile(file, 'utf8'),
        file,
      ) as RenovateConfig;
    case '.cjs':
    case '.js': {
      const tmpConfig = await import(
        upath.isAbsolute(file) ? file : `${process.cwd()}/${file}`
      );
      let config = tmpConfig.default
        ? tmpConfig.default
        : /* istanbul ignore next: hard to test */ tmpConfig;
      // Allow the config to be a function
      if (is.function_(config)) {
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

  if (env.RENOVATE_CONFIG_FILE && !(await fs.pathExists(configFile))) {
    logger.fatal(
      { configFile },
      `Custom config file specified in RENOVATE_CONFIG_FILE must exist`,
    );
    process.exit(1);
  }

  logger.debug('Checking for config file in ' + configFile);
  let config: AllConfig = {};
  try {
    config = await getParsedContent(configFile);
  } catch (err) {
    if (err instanceof SyntaxError || err instanceof TypeError) {
      logger.fatal(`Could not parse config file \n ${err.stack!}`);
      process.exit(1);
    } else if (err instanceof ReferenceError) {
      logger.fatal(
        `Error parsing config file due to unresolved variable(s): ${err.message}`,
      );
      process.exit(1);
    } else if (err.message === 'Unsupported file type') {
      logger.fatal(err.message);
      process.exit(1);
    } else if (env.RENOVATE_CONFIG_FILE) {
      logger.fatal('Error parsing config file');
      process.exit(1);
    }
    // istanbul ignore next: we can ignore this
    logger.debug('No config file found on disk - skipping');
  }

  await deleteNonDefaultConfig(env); // Try deletion only if RENOVATE_CONFIG_FILE is specified

  return migrateAndValidateConfig(config, configFile);
}

export async function deleteNonDefaultConfig(
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const configFile = env.RENOVATE_CONFIG_FILE;

  if (is.undefined(configFile) || is.emptyStringOrWhitespace(configFile)) {
    return;
  }

  if (env.RENOVATE_X_DELETE_CONFIG_FILE !== 'true') {
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
