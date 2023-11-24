import is from '@sindresorhus/is';
import { logger } from '../logger';
import { resolveConfigPresets } from './presets';
import type { RenovateConfig } from './types';
import { mergeChildConfig } from './utils';

// This needs to be kept in sync with Renovate major releases
// It cannot read it from package.json because in dev we use 0.0.0-semantic-release
export const defaultRenovateCompatibility = 37;
export const currentRenovateCompatibility = 38;

export function resolveCompatibilityVersion(
  renovateCompatibility?: number,
): number {
  if (is.nullOrUndefined(renovateCompatibility)) {
    logger.debug(
      `renovateCompatibility is not set, defaulting to ${defaultRenovateCompatibility}`,
    );
    return defaultRenovateCompatibility;
  }
  if (!is.number(renovateCompatibility)) {
    logger.warn(
      `renovateCompatibility is not a number: (typeof ${typeof renovateCompatibility})`,
    );
    return defaultRenovateCompatibility;
  }
  if (renovateCompatibility === 0) {
    logger.debug(`renovateCompatibility is 0, using latest defaults`);
    return currentRenovateCompatibility;
  }
  if (renovateCompatibility === currentRenovateCompatibility) {
    logger.debug(
      `renovateCompatibility is current (${currentRenovateCompatibility}, using latest defaults`,
    );
    return currentRenovateCompatibility;
  }
  if (
    renovateCompatibility < defaultRenovateCompatibility ||
    renovateCompatibility > currentRenovateCompatibility
  ) {
    logger.debug(
      `renovateCompatibility has invalid value ${renovateCompatibility}, defaulting to ${defaultRenovateCompatibility}`,
    );
    return defaultRenovateCompatibility;
  }
  return renovateCompatibility;
}

export async function mergeCompatibilityConfig(
  config: RenovateConfig,
  renovateCompatibility: number,
): Promise<RenovateConfig> {
  const compatibilityPreset = `compatibility:v${renovateCompatibility}`;
  logger.debug(`Adding renovateCompatibility preset: ${compatibilityPreset}`);
  const compatilityConfig = { extends: [compatibilityPreset] };
  const resolvedCompatiblityConfig =
    await resolveConfigPresets(compatilityConfig);
  delete resolvedCompatiblityConfig.description;
  logger.debug(
    { config: resolvedCompatiblityConfig },
    'Resolved renovateCompatibility config',
  );
  return mergeChildConfig(config, resolvedCompatiblityConfig);
}
