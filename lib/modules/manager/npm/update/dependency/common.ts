import { logger } from '../../../../../logger/index.ts';
import type { Upgrade } from '../../../types.ts';

export function getNewGitValue(upgrade: Upgrade): string | null {
  if (!upgrade.currentRawValue) {
    return null;
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
): string | null {
  if (!upgrade.npmPackageAlias) {
    return null;
  }
  return `npm:${upgrade.packageName}@${value}`;
}
