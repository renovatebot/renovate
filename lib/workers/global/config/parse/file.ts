import { readFileSync } from 'fs-extra';
import { load } from 'js-yaml';
import JSON5 from 'json5';
import upath from 'upath';
import { migrateConfig } from '../../../../config/migration';
import type { AllConfig, RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';

export function getParsedContent(file: string): RenovateConfig {
  const rawContent = readFileSync(file, 'utf8');
  switch (upath.extname(file)) {
    case '.yaml':
    case '.yml':
      return load(rawContent, { json: true }) as RenovateConfig;
    case '.json5':
      return JSON5.parse(rawContent);
    default:
      // .json and .js
      return require(file);
  }
}

export function getConfig(env: NodeJS.ProcessEnv): AllConfig {
  let configFile = env.RENOVATE_CONFIG_FILE || 'config';
  if (!upath.isAbsolute(configFile)) {
    configFile = `${process.cwd()}/${configFile}`;
    logger.debug('Checking for config file in ' + configFile);
  }
  let config: AllConfig = {};
  try {
    config = getParsedContent(configFile);
  } catch (err) {
    // istanbul ignore if
    if (err instanceof SyntaxError || err instanceof TypeError) {
      logger.fatal(`Could not parse config file \n ${err.stack}`);
      process.exit(1);
    } else if (env.RENOVATE_CONFIG_FILE) {
      logger.fatal('No custom config file found on disk');
      process.exit(1);
    } else {
      // istanbul ignore next: we can ignore this
      logger.debug('No config file found on disk - skipping');
    }
  }
  const { isMigrated, migratedConfig } = migrateConfig(config);
  if (isMigrated) {
    logger.warn(
      { originalConfig: config, migratedConfig },
      'Config needs migrating'
    );
    config = migratedConfig;
  }
  return config;
}
