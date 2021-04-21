import { getPreset } from '../../../../config/presets/local';
import { PRESET_DEP_NOT_FOUND } from '../../../../config/presets/util';
import type { RenovateConfig } from '../../../../config/types';
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
    const packageName = `${orgName}/renovate-config`;
    await getPreset({ packageName, baseConfig: config });
    orgPreset = `local>${packageName}`;
  } catch (err) {
    if (
      err.message !== PRESET_DEP_NOT_FOUND &&
      !err.message.startsWith('Unsupported platform')
    ) {
      logger.warn({ err }, 'Unknown error fetching default owner preset');
    }
  }

  if (!orgPreset) {
    // Check for org/.{{platform}}
    try {
      const packageName = `${orgName}/.${config.platform}`;
      const presetName = 'renovate-config';
      await getPreset({
        packageName,
        presetName,
        baseConfig: config,
      });
      orgPreset = `local>${packageName}:${presetName}`;
    } catch (err) {
      if (
        err.message !== PRESET_DEP_NOT_FOUND &&
        !err.message.startsWith('Unsupported platform')
      ) {
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
