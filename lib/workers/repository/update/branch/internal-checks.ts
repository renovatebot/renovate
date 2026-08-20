import { isNonEmptyString } from '@sindresorhus/is';
import type {
  MinimumReleaseAgeBehaviour,
  UpdateType,
} from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import { getElapsedMs } from '../../../../util/date.ts';
import {
  getMergeConfidenceLevel,
  isActiveConfidenceLevel,
  satisfiesConfidenceLevel,
} from '../../../../util/merge-confidence/index.ts';
import { coerceNumber } from '../../../../util/number.ts';
import { toMs } from '../../../../util/pretty-time.ts';
import type { BranchConfig } from '../../../types.ts';

function addPendingChecksReason(config: BranchConfig, reason: string): void {
  config.pendingChecksReasons ??= [];
  config.pendingChecksReasons.push(reason);
}

export async function applyInternalChecksStatus(
  config: BranchConfig,
): Promise<void> {
  if (
    !config.upgrades.some(
      (upgrade) =>
        isNonEmptyString(upgrade.minimumReleaseAge) ||
        isActiveConfidenceLevel(upgrade.minimumConfidence!),
    )
  ) {
    return;
  }

  const depNamesWithoutReleaseTimestamp: Record<
    MinimumReleaseAgeBehaviour,
    {
      depName: string;
      updateType: UpdateType;
    }[]
  > = {
    'timestamp-required': [],
    'timestamp-optional': [],
  };

  // Only set a stability status check if one or more of the updates contain
  // both a minimumReleaseAge setting and a releaseTimestamp.
  config.stabilityStatus = 'green';
  // Default to 'success' but set 'pending' if any update is pending.
  for (const upgrade of config.upgrades) {
    const minimumReleaseAgeMs = isNonEmptyString(upgrade.minimumReleaseAge)
      ? coerceNumber(toMs(upgrade.minimumReleaseAge), 0)
      : 0;

    if (minimumReleaseAgeMs) {
      const minimumReleaseAgeBehaviour: MinimumReleaseAgeBehaviour =
        upgrade.minimumReleaseAgeBehaviour ?? 'timestamp-required';

      // Regardless of minimumReleaseAgeBehaviour, if there is a timestamp,
      // process it according to minimumReleaseAge.
      if (upgrade.releaseTimestamp) {
        const timeElapsed = getElapsedMs(upgrade.releaseTimestamp);
        if (timeElapsed < minimumReleaseAgeMs) {
          const remainingHours = Math.ceil(
            (minimumReleaseAgeMs - timeElapsed) / 3_600_000,
          );
          logger.debug(
            {
              depName: upgrade.depName,
              timeElapsed,
              minimumReleaseAge: upgrade.minimumReleaseAge,
            },
            'Update has not passed minimum release age',
          );
          config.stabilityStatus = 'yellow';
          addPendingChecksReason(
            config,
            `\`${upgrade.depName}\`: minimum release age not met (${upgrade.minimumReleaseAge} required, ${remainingHours}h remaining)`,
          );
          continue;
        }
      } else if (minimumReleaseAgeBehaviour === 'timestamp-required') {
        depNamesWithoutReleaseTimestamp['timestamp-required'].push({
          depName: upgrade.depName!,
          updateType: upgrade.updateType!,
        });
        config.stabilityStatus = 'yellow';
        addPendingChecksReason(
          config,
          `\`${upgrade.depName}\`: release timestamp unavailable - minimum release age (${upgrade.minimumReleaseAge}) cannot be evaluated`,
        );
        continue;
      } else {
        // If there is no timestamp and we're running in optional mode, allow it
        // but make sure to warn the user.
        depNamesWithoutReleaseTimestamp['timestamp-optional'].push({
          depName: upgrade.depName!,
          updateType: upgrade.updateType!,
        });
      }
    }

    const datasource = upgrade.datasource!;
    const depName = upgrade.depName!;
    const packageName = upgrade.packageName!;
    const minimumConfidence = upgrade.minimumConfidence!;
    const updateType = upgrade.updateType!;
    const currentVersion = upgrade.currentVersion!;
    const newVersion = upgrade.newVersion!;
    if (isActiveConfidenceLevel(minimumConfidence)) {
      const confidence =
        (await getMergeConfidenceLevel(
          datasource,
          packageName,
          currentVersion,
          newVersion,
          updateType,
        )) ?? 'neutral';
      if (satisfiesConfidenceLevel(confidence, minimumConfidence)) {
        config.confidenceStatus = 'green';
      } else {
        logger.debug(
          { depName, confidence, minimumConfidence },
          'Update does not meet minimum confidence scores',
        );
        config.confidenceStatus = 'yellow';
        addPendingChecksReason(
          config,
          `\`${depName}\`: merge confidence too low (required: ${minimumConfidence})`,
        );
        continue;
      }
    }
  }

  if (depNamesWithoutReleaseTimestamp['timestamp-required'].length) {
    logger.once.debug(
      { updates: depNamesWithoutReleaseTimestamp['timestamp-required'] },
      `Marking ${depNamesWithoutReleaseTimestamp['timestamp-required'].length} release(s) as pending, as they do not have a releaseTimestamp and we're running with minimumReleaseAgeBehaviour=timestamp-required`,
    );
  }
  if (depNamesWithoutReleaseTimestamp['timestamp-optional'].length) {
    logger.once.warn(
      "Some upgrade(s) did not have a releaseTimestamp, but as we're running with minimumReleaseAgeBehaviour=timestamp-optional, proceeding. See debug logs for more information",
    );
    logger.once.debug(
      { updates: depNamesWithoutReleaseTimestamp['timestamp-optional'] },
      `${depNamesWithoutReleaseTimestamp['timestamp-optional'].length} upgrade(s) did not have a releaseTimestamp, but as we're running with minimumReleaseAgeBehaviour=timestamp-optional, proceeding`,
    );
  }
}
