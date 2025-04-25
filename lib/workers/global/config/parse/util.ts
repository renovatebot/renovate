import { dequal } from 'dequal';
import { massageConfig } from '../../../../config/massage';
import { migrateConfig } from '../../../../config/migration';
import type { RenovateConfig } from '../../../../config/types';
import { validateConfig } from '../../../../config/validation';
import { logger } from '../../../../logger';

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
