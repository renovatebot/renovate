import is from '@sindresorhus/is';
import { dequal } from 'dequal';
import { logger } from '../logger';
import * as configMassage from './massage';
import * as configMigration from './migration';
import type { RenovateConfig, ValidationMessage } from './types';
import * as configValidation from './validation';

export async function migrateAndValidate(
  config: RenovateConfig,
  input: RenovateConfig,
): Promise<RenovateConfig> {
  logger.debug('migrateAndValidate()');
  try {
    const { isMigrated, migratedConfig } = configMigration.migrateConfig(input);
    if (isMigrated) {
      logger.debug(
        { oldConfig: input, newConfig: migratedConfig },
        'Config migration necessary',
      );
    } else {
      logger.debug('No config migration necessary');
    }
    const massagedConfig = configMassage.massageConfig(migratedConfig);
    // log only if it's changed
    if (!dequal(input, massagedConfig)) {
      logger.debug({ config: massagedConfig }, 'Post-massage config');
    }
    const {
      warnings,
      errors,
    }: {
      warnings: ValidationMessage[];
      errors: ValidationMessage[];
    } = await configValidation.validateConfig('repo', massagedConfig);
    // istanbul ignore if
    if (is.nonEmptyArray(warnings)) {
      logger.warn({ warnings }, 'Found renovate config warnings');
    }
    if (is.nonEmptyArray(errors)) {
      logger.info({ errors }, 'Found renovate config errors');
    }
    massagedConfig.errors = (config.errors ?? []).concat(errors);
    if (!config.repoIsOnboarded) {
      massagedConfig.warnings = (config.warnings ?? []).concat(warnings);
    }
    return massagedConfig;
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ config: input }, 'migrateAndValidate error');
    throw err;
  }
}
