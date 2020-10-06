import { RenovateConfig } from '../../../../config';
import { getPreset } from '../../../../config/presets';
import { PRESET_DEP_NOT_FOUND } from '../../../../config/presets/util';
import { logger } from '../../../../logger';
import { clone } from '../../../../util/clone';

export async function getOnboardingConfig(
  config: RenovateConfig
): Promise<string> {
  let onboardingConfig = clone(config.onboardingConfig);

  let organizationConfigRepoExists = false;
  const organizationConfigPresetName = `local>${config.owner}/renovate-config`;

  try {
    if (config.owner) {
      await getPreset(organizationConfigPresetName, config);
      organizationConfigRepoExists = true;
    }
  } catch (err) {
    if (err.message !== PRESET_DEP_NOT_FOUND) {
      logger.warn({ err }, 'Unknown error fetching default owner preset');
    }
    // Organization preset did not exist
  }
  if (organizationConfigRepoExists) {
    onboardingConfig = {
      $schema: 'https://docs.renovatebot.com/renovate-schema.json',
      extends: [organizationConfigPresetName],
    };
  }

  logger.debug({ config: onboardingConfig }, 'onboarding config');
  return JSON.stringify(onboardingConfig, null, 2) + '\n';
}
