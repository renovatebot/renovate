import { isNonEmptyString } from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global.ts';
import type {
  MinimumReleaseAgeBehaviour,
  RenovateConfig,
  UpdateType,
} from '../../../../config/types.ts';
import { logger } from '../../../../logger/index.ts';
import { platform } from '../../../../modules/platform/index.ts';
import type { BranchStatusConfig } from '../../../../modules/platform/types.ts';
import type { BranchStatus } from '../../../../types/index.ts';
import { getElapsedMs } from '../../../../util/date.ts';
import {
  getMergeConfidenceLevel,
  isActiveConfidenceLevel,
  satisfiesConfidenceLevel,
} from '../../../../util/merge-confidence/index.ts';
import type { MergeConfidence } from '../../../../util/merge-confidence/types.ts';
import { coerceNumber } from '../../../../util/number.ts';
import { toMs } from '../../../../util/pretty-time.ts';
import { joinUrlParts } from '../../../../util/url.ts';
import type { BranchConfig } from '../../../types.ts';

export async function resolveBranchStatus(
  branchName: string,
  internalChecksAsSuccess: boolean,
  ignoreTests = false,
): Promise<BranchStatus> {
  logger.debug(
    `resolveBranchStatus(branchName=${branchName}, ignoreTests=${ignoreTests})`,
  );

  if (ignoreTests) {
    logger.debug('Ignore tests. Return green');
    return 'green';
  }

  const status = await platform.getBranchStatus(
    branchName,
    internalChecksAsSuccess,
  );
  logger.debug(`Branch status ${status}`);

  return status;
}

async function setStatusCheck({
  branchName,
  context,
  description,
  state,
  url,
}: BranchStatusConfig): Promise<void> {
  const existingState = await platform.getBranchStatusCheck(
    branchName,
    context,
  );
  if (existingState === state) {
    logger.debug(`Status check ${context} is already up-to-date`);
  } else {
    if (GlobalConfig.get('dryRun')) {
      logger.info(
        `DRY-RUN: Would update ${context} status check state to ${state}`,
      );
      return;
    }
    logger.debug(`Updating ${context} status check state to ${state}`);
    await platform.setBranchStatus({
      branchName,
      context,
      description,
      state,
      url,
    });
  }
}

export interface StabilityConfig extends RenovateConfig {
  stabilityStatus?: BranchStatus;
  branchName: string;
}

export async function setStability(config: StabilityConfig): Promise<void> {
  const mode = config.statusCheckWhen?.minimumReleaseAge ?? 'always';

  if (mode === 'never') {
    if (config.stabilityStatus) {
      logger.debug(
        'statusCheckWhen.minimumReleaseAge is set to "never", skipping stability status check.',
      );
    }
    return;
  }

  if (!config.stabilityStatus) {
    return;
  }

  if (mode === 'failed' && config.stabilityStatus === 'green') {
    return;
  }

  const context = config.statusCheckNames?.minimumReleaseAge;
  if (!context) {
    logger.debug(
      'Status check is null or an empty string, skipping status check addition.',
    );
    return;
  }

  const description =
    config.stabilityStatus === 'green'
      ? 'Updates have met minimum release age requirement'
      : 'Updates have not met minimum release age requirement';

  const docsLink = joinUrlParts(
    GlobalConfig.get('productLinks').documentation,
    'key-concepts/minimum-release-age/',
  );

  await setStatusCheck({
    branchName: config.branchName,
    context,
    description,
    state: config.stabilityStatus,
    url: docsLink,
  });
}

export interface ConfidenceConfig extends RenovateConfig {
  confidenceStatus?: BranchStatus;
  minimumConfidence?: MergeConfidence | undefined;
}

export async function setConfidence(config: ConfidenceConfig): Promise<void> {
  const mode = config.statusCheckWhen?.mergeConfidence ?? 'always';

  if (mode === 'never') {
    if (config.branchName && config.confidenceStatus) {
      logger.debug(
        'statusCheckWhen.mergeConfidence is set to "never", skipping merge confidence status check.',
      );
    }
    return;
  }

  if (
    !config.branchName ||
    !config.confidenceStatus ||
    (config.minimumConfidence &&
      !isActiveConfidenceLevel(config.minimumConfidence))
  ) {
    return;
  }

  if (mode === 'failed' && config.confidenceStatus === 'green') {
    return;
  }

  const context = config.statusCheckNames?.mergeConfidence;
  if (!context) {
    logger.debug(
      'Status check is null or an empty string, skipping status check addition.',
    );
    return;
  }

  const description =
    config.confidenceStatus === 'green'
      ? 'Updates have met Merge Confidence requirement'
      : 'Updates have not met Merge Confidence requirement';

  const docsLink = joinUrlParts(
    GlobalConfig.get('productLinks').documentation,
    'merge-confidence',
  );

  await setStatusCheck({
    branchName: config.branchName,
    context,
    description,
    state: config.confidenceStatus,
    url: docsLink,
  });
}

export interface InternalChecksStatus {
  stabilityStatus?: BranchStatus;
  confidenceStatus?: BranchStatus;
}

/**
 * Computes the internal checks status of a branch from its upgrades, i.e. their
 * minimum release age and their merge confidence. Returns `null` if none of the
 * upgrades has any internal check configured.
 */
export async function computeInternalChecksStatus(
  config: BranchConfig,
): Promise<InternalChecksStatus | null> {
  const internalChecksConfigured = config.upgrades.some(
    (upgrade) =>
      isNonEmptyString(upgrade.minimumReleaseAge) ||
      isActiveConfidenceLevel(upgrade.minimumConfidence!),
  );
  if (!internalChecksConfigured) {
    return null;
  }

  const status: InternalChecksStatus = {};
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
  // both a minimumReleaseAge setting and a releaseTimestamp
  status.stabilityStatus = 'green';
  // Default to 'success' but set 'pending' if any update is pending
  for (const upgrade of config.upgrades) {
    const minimumReleaseAgeMs = isNonEmptyString(upgrade.minimumReleaseAge)
      ? coerceNumber(toMs(upgrade.minimumReleaseAge), 0)
      : 0;

    if (minimumReleaseAgeMs) {
      const minimumReleaseAgeBehaviour: MinimumReleaseAgeBehaviour =
        upgrade.minimumReleaseAgeBehaviour ?? 'timestamp-required';

      // regardless of the value of `minimumReleaseAgeBehaviour`, if there is a timestamp, we will process it according to `minimumReleaseAge`
      if (upgrade.releaseTimestamp) {
        const timeElapsed = getElapsedMs(upgrade.releaseTimestamp);
        if (timeElapsed < minimumReleaseAgeMs) {
          logger.debug(
            {
              depName: upgrade.depName,
              timeElapsed,
              minimumReleaseAge: upgrade.minimumReleaseAge,
            },
            'Update has not passed minimum release age',
          );
          status.stabilityStatus = 'yellow';
          continue;
        }
      } else {
        // if we're set to `minimumReleaseAgeBehaviour=timestamp-required`, and there isn't a timestamp, always mark the update as pending
        if (minimumReleaseAgeBehaviour === 'timestamp-required') {
          depNamesWithoutReleaseTimestamp['timestamp-required'].push({
            depName: upgrade.depName!,
            updateType: upgrade.updateType!,
          });
          status.stabilityStatus = 'yellow';
          continue;
        } else {
          // if there is no timestamp, and we're running in `optional` mode, we can allow it, but make sure to warn the user
          depNamesWithoutReleaseTimestamp['timestamp-optional'].push({
            depName: upgrade.depName!,
            updateType: upgrade.updateType!,
          });
        }
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
        status.confidenceStatus = 'green';
      } else {
        logger.debug(
          { depName, confidence, minimumConfidence },
          'Update does not meet minimum confidence scores',
        );
        status.confidenceStatus = 'yellow';
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

  return status;
}
