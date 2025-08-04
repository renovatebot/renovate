import { pathToFileURL } from 'url';
import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import upath from 'upath';
import { massageConfig } from '../../../../config/massage';
import { migrateConfig } from '../../../../config/migration';
import type { RenovateConfig } from '../../../../config/types';
import { validateConfig } from '../../../../config/validation';
import { logger } from '../../../../logger';
import { parseJson } from '../../../../util/common';
import { readSystemFile } from '../../../../util/fs';
import { parseSingleYaml } from '../../../../util/yaml';

export async function migrateAndValidateConfig(
  config: RenovateConfig,
  configType: string,
): Promise<RenovateConfig> {
  const { isMigrated, migratedConfig } = migrateConfig(config);
  if (isMigrated) {
    logger.warn(
      { configType, originalConfig: config, migratedConfig },
      'Config needs migrating',
    );
  }
  const massagedConfig = massageConfig(migratedConfig);
  // log only if it's changed
  if (!dequal(migratedConfig, massagedConfig)) {
    logger.trace({ config: massagedConfig }, 'Post-massage config');
  }

  const { warnings, errors } = await validateConfig('global', massagedConfig);

  if (warnings.length) {
    logger.warn({ configType, warnings }, 'Config validation warnings found');
  }
  if (errors.length) {
    logger.warn({ configType, errors }, 'Config validation errors found');
  }

  return massagedConfig;
}

export async function getParsedContent(file: string): Promise<RenovateConfig> {
  if (upath.basename(file) === '.renovaterc') {
    return parseJson(
      await readSystemFile(file, 'utf8'),
      file,
    ) as RenovateConfig;
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
