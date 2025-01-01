import { logger } from '../../../../../logger';
import type { Upgrade } from '../../../types';

export function getNewGitValue(upgrade: Upgrade): string | undefined {
  if (!upgrade.currentRawValue) {
    return;
  }
  if (upgrade.currentDigest) {
    logger.debug('Updating git digest');
    return upgrade.currentRawValue.replace(
      upgrade.currentDigest,
      // TODO #22198

      upgrade.newDigest!.substring(0, upgrade.currentDigest.length),
    );
  } else {
    logger.debug('Updating git version tag');
    return upgrade.currentRawValue.replace(
      upgrade.currentValue,
      upgrade.newValue,
    );
  }
}

export function getNewNpmAliasValue(
  value: string | undefined,
  upgrade: Upgrade,
): string | undefined {
  if (!upgrade.npmPackageAlias) {
    return;
  }
  return `npm:${upgrade.packageName}@${value}`;
}
