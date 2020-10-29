import { RenovateConfig } from '../../../../config';
import { getPreset } from '../../../../config/presets';
import { PRESET_DEP_NOT_FOUND } from '../../../../config/presets/util';
import { logger } from '../../../../logger';
import { clone } from '../../../../util/clone';

export async function getOnboardingConfig(
  config: RenovateConfig
): Promise<string> {
  let onboardingConfig = clone(config.onboardingConfig);

  let orgPreset: string;

  logger.debug(
    'Checking if this org/owner has a default Renovate preset which can be used.'
  );

  const orgName = config.repository.split('/')[0];

  // Check for org/renovate-config
  try {
    const orgRenovateConfig = `local>${orgName}/renovate-config`;
    await getPreset(orgRenovateConfig, config);
    orgPreset = orgRenovateConfig;
  } catch (err) {
    if (err.message !== PRESET_DEP_NOT_FOUND) {
      logger.warn({ err }, 'Unknown error fetching default owner preset');
    }
  }

  if (!orgPreset) {
    // Check for org/.{{platform}}
    try {
      const orgDotPlatformConfig = `local>${orgName}/.${config.platform}:renovate-config`;
      await getPreset(orgDotPlatformConfig, config);
      orgPreset = orgDotPlatformConfig;
    } catch (err) {
      if (err.message !== PRESET_DEP_NOT_FOUND) {
        logger.warn({ err }, 'Unknown error fetching default owner preset');
      }
    }
  }

  if (orgPreset) {
    onboardingConfig = {
      $schema: 'https://docs.renovatebot.com/renovate-schema.json',
      extends: [orgPreset],
    };
  } else {
    // Organization preset did not exist
    logger.debug(
      'No default org/owner preset found, so the default onboarding config will be used instead. Note: do not be concerned with any 404 messages that preceded this.'
    );
  }

  logger.debug({ config: onboardingConfig }, 'onboarding config');
  return JSON.stringify(onboardingConfig, null, 2) + '\n';
}
