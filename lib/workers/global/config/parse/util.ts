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
      { originalConfig: config, migratedConfig },
      `${configType} needs migrating`,
    );
  }

  const { warnings, errors } = await validateConfig('global', migratedConfig);

  if (warnings.length) {
    logger.warn(
      { warnings },
      `Config validation warnings found in ${configType}`,
    );
  }
  if (errors.length) {
    logger.warn({ errors }, `Config validation errors found in ${configType}`);
  }

  return migratedConfig;
}
