import { GlobalConfig } from '../../../../config/global';
import { getPreset } from '../../../../config/presets/local';
import { PRESET_DEP_NOT_FOUND } from '../../../../config/presets/util';
import type {
  RenovateConfig,
  RenovateSharedConfig,
} from '../../../../config/types';
import { logger } from '../../../../logger';
import { clone } from '../../../../util/clone';
import { EditorConfig, JSONWriter } from '../../../../util/json-writer';

async function getOnboardingConfig(
  config: RenovateConfig,
): Promise<RenovateSharedConfig | undefined> {
  let onboardingConfig = clone(config.onboardingConfig);

  let orgPreset: string | undefined;

  logger.debug(
    'Checking if this org/owner has a default Renovate preset which can be used.',
  );

  // TODO #22198
  const orgName = config.repository!.split('/')[0];

  // Check for org/renovate-config
  try {
    const repo = `${orgName}/renovate-config`;
    if (await getPreset({ repo })) {
      orgPreset = `local>${repo}`;
    }
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
    // TODO: types (#22198)
    const platform = GlobalConfig.get('platform')!;
    try {
      const repo = `${orgName}/.${platform}`;
      const presetName = 'renovate-config';
      if (
        await getPreset({
          repo,
          presetName,
        })
      ) {
        orgPreset = `local>${repo}:${presetName}`;
      }
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
    logger.debug(
      `Found org preset ${orgPreset} - using it in onboarding config`,
    );
    onboardingConfig = {
      $schema: 'https://docs.renovatebot.com/renovate-schema.json',
      extends: [orgPreset],
    };
  } else {
    // Organization preset did not exist
    logger.debug(
      'No default org/owner preset found, so the default onboarding config will be used instead. Note: do not be concerned with any 404 messages that preceded this.',
    );
  }

  logger.debug({ config: onboardingConfig }, 'onboarding config');
  return onboardingConfig;
}

async function getOnboardingConfigContents(
  config: RenovateConfig,
  fileName: string,
): Promise<string> {
  const codeFormat = await EditorConfig.getCodeFormat(fileName);
  const jsonWriter = new JSONWriter(codeFormat);
  const onboardingConfig = await getOnboardingConfig(config);
  return jsonWriter.write(onboardingConfig);
}

export { getOnboardingConfig, getOnboardingConfigContents };
