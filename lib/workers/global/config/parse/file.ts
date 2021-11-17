import { readFile } from 'fs-extra';
import { load } from 'js-yaml';
import JSON5 from 'json5';
import upath from 'upath';
import { migrateConfig } from '../../../../config/migration';
import type { AllConfig, RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';

export async function getParsedContent(file: string): Promise<RenovateConfig> {
  switch (upath.extname(file)) {
    case '.yaml':
    case '.yml':
      return load(await readFile(file, 'utf8'), {
        json: true,
      }) as RenovateConfig;
    case '.json5':
      return JSON5.parse(await readFile(file, 'utf8'));
    default: {
      // .json and .js
      const tmpConfig = await import(file);
      return tmpConfig.default ? tmpConfig.default : tmpConfig;
    }
  }
}

export async function getConfig(env: NodeJS.ProcessEnv): Promise<AllConfig> {
  let configFile = env.RENOVATE_CONFIG_FILE || 'config';
  if (!upath.isAbsolute(configFile)) {
    configFile = `${process.cwd()}/${configFile}`;
    logger.debug('Checking for config file in ' + configFile);
  }
  let config: AllConfig = {};
  try {
    config = await getParsedContent(configFile);
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
