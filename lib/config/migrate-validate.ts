import is from '@sindresorhus/is';
import { logger } from '../logger';
import { massageConfig } from './massage';
import { migrateConfig } from './migration';
import type { RenovateConfig, ValidationMessage } from './types';
import { validateConfig } from './validation';

export async function migrateAndValidate(
  config: RenovateConfig,
  input: RenovateConfig
): Promise<RenovateConfig> {
  logger.debug('migrateAndValidate()');
  try {
    const { isMigrated, migratedConfig } = migrateConfig(input);
    if (isMigrated) {
      logger.debug(
        { oldConfig: input, newConfig: migratedConfig },
        'Config migration necessary'
      );
    } else {
      logger.debug('No config migration necessary');
    }
    const massagedConfig = massageConfig(migratedConfig);
    logger.debug({ config: massagedConfig }, 'massaged config');
    const {
      warnings,
      errors,
    }: {
      warnings: ValidationMessage[];
      errors: ValidationMessage[];
    } = await validateConfig(massagedConfig);
    /* c8 ignore next 3 */
    if (is.nonEmptyArray(warnings)) {
      logger.warn({ warnings }, 'Found renovate config warnings');
    }
    if (is.nonEmptyArray(errors)) {
      logger.info({ errors }, 'Found renovate config errors');
    }
    massagedConfig.errors = (config.errors || []).concat(errors);
    if (!config.repoIsOnboarded) {
      massagedConfig.warnings = (config.warnings || []).concat(warnings);
    }
    return massagedConfig;
    /* c8 ignore next 4 */
  } catch (err) {
    logger.debug({ config: input }, 'migrateAndValidate error');
    throw err;
  }
}
