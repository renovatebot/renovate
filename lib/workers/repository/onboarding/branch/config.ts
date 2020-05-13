import is from '@sindresorhus/is';
import { RenovateConfig } from '../../../../config';
import { logger } from '../../../../logger';
import { clone } from '../../../../util/clone';
import { readLocalFile } from '../../../../util/fs';

export async function getOnboardingConfig(
  config: RenovateConfig
): Promise<string> {
  const onboardingConfig = clone(config.onboardingConfig);
  try {
    logger.debug('Checking for greenkeeper config');

    const greenkeeperConfig = JSON.parse(
      await readLocalFile('package.json', 'utf8')
    ).greenkeeper;
    if (greenkeeperConfig) {
      onboardingConfig.statusCheckVerify = true;
    }
    const { label, branchName, ignore } = greenkeeperConfig;
    if (label) {
      logger.debug({ label }, 'Migrating Greenkeeper label');
      onboardingConfig.labels = [
        String(label).replace('greenkeeper', 'renovate'),
      ];
    }
    if (branchName) {
      logger.debug({ branch: branchName }, 'Migrating Greenkeeper branchName');
      onboardingConfig.branchName = String(branchName).replace(
        'greenkeeper',
        'renovate'
      );
    }
    if (is.nonEmptyArray(ignore)) {
      logger.debug({ ignore }, 'Migrating Greenkeeper ignore');
      onboardingConfig.ignoreDeps = ignore.map(String);
    }
  } catch (err) {
    logger.debug('No greenkeeper config migration');
  }
  logger.debug({ config: onboardingConfig }, 'onboarding config');
  return JSON.stringify(onboardingConfig, null, 2) + '\n';
}
