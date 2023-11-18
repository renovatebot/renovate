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

  let foundPreset: string | undefined;

  logger.debug('Checking for a default Renovate preset which can be used.');

  // TODO #22198
  const repoPathParts = config.repository!.split('/');

  for (
    let index = repoPathParts.length - 1;
    index >= 1 && !foundPreset;
    index--
  ) {
    const groupName = repoPathParts.slice(0, index).join('/');

    // Check for group/renovate-config
    try {
      const repo = `${groupName}/renovate-config`;
      if (await getPreset({ repo })) {
        foundPreset = `local>${repo}`;
      }
    } catch (err) {
      if (
        err.message !== PRESET_DEP_NOT_FOUND &&
        !err.message.startsWith('Unsupported platform')
      ) {
        logger.warn({ err }, 'Unknown error fetching group preset');
      }
    }
  }

  if (!foundPreset) {
    // Check for org/.{{platform}}

    // TODO #22198
    const orgName = config.repository!.split('/')[0];

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
        foundPreset = `local>${repo}:${presetName}`;
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

  if (foundPreset) {
    logger.debug(`Found preset ${foundPreset} - using it in onboarding config`);
    onboardingConfig = {
      $schema: 'https://docs.renovatebot.com/renovate-schema.json',
      extends: [foundPreset],
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
