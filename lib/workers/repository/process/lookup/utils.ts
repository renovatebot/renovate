import {
  isNonEmptyString,
  isNullOrUndefined,
  isString,
} from '@sindresorhus/is';

import { getRangeStrategy } from '../../../../modules/manager/index.ts';
import type { LookupUpdate } from '../../../../modules/manager/types.ts';
import * as allVersioning from '../../../../modules/versioning/index.ts';
import * as template from '../../../../util/template/index.ts';
import type { LookupUpdateConfig } from './types.ts';

export function addReplacementUpdateIfValid(
  updates: LookupUpdate[],
  config: LookupUpdateConfig,
): void {
  const replacementNewName = determineNewReplacementName(config);
  const replacementNewValue = determineNewReplacementValue(config);

  if (
    config.packageName !== replacementNewName ||
    config.currentValue !== replacementNewValue
  ) {
    updates.push({
      updateType: 'replacement',
      newName: replacementNewName,
      newValue: replacementNewValue!,
    });
  }
}

export function isReplacementRulesConfigured(
  config: LookupUpdateConfig,
): boolean {
  return (
    isNonEmptyString(config.replacementName) ||
    isNonEmptyString(config.replacementNameTemplate) ||
    isNonEmptyString(config.replacementVersion) ||
    isNonEmptyString(config.replacementVersionTemplate)
  );
}

export function determineNewReplacementName(
  config: LookupUpdateConfig,
): string {
  if (config.replacementName) {
    return config.replacementName;
  }
  if (config.replacementNameTemplate) {
    return template.compile(config.replacementNameTemplate, config, true);
  }
  return config.packageName;
}

export function determineNewReplacementValue(
  config: LookupUpdateConfig,
): string | undefined | null {
  const newVersion = getNewVersion(config);
  if (!newVersion) {
    return config.currentValue;
  }

  const versioningApi = allVersioning.get(config.versioning);
  const rangeStrategy = getRangeStrategy(config);

  return versioningApi.getNewValue({
    // TODO #22198
    currentValue: config.currentValue!,
    newVersion,
    rangeStrategy: rangeStrategy!,
    isReplacement: true,
  });
}

function getNewVersion(config: LookupUpdateConfig): string | null {
  if (!isNullOrUndefined(config.replacementVersion)) {
    return config.replacementVersion;
  }
  if (!isNullOrUndefined(config.replacementVersionTemplate)) {
    return template.compile(config.replacementVersionTemplate, config, true);
  }
  return null;
}

/**
 * Drop every update which would not actually change the package file, plus the
 * updates excluded by `rangeStrategy=in-range-only` and by the `rollbackPrs` +
 * `followTag` edge case.
 */
export function stripNoopUpdates(
  config: LookupUpdateConfig,
  updates: LookupUpdate[],
): LookupUpdate[] {
  let result = updates
    .filter(
      (update) => update.newValue !== null || config.currentValue === null,
    )
    .filter((update) => update.newDigest !== null)
    .filter(
      (update) =>
        (isString(update.newName) && update.newName !== config.packageName) ||
        update.isReplacement === true ||
        update.newValue !== config.currentValue ||
        update.isLockfileUpdate === true ||
        // TODO #22198
        (update.newDigest &&
          !update.newDigest.startsWith(config.currentDigest!)),
    );

  // If range strategy specified in config is 'in-range-only', also strip out updates where currentValue !== newValue
  if (config.rangeStrategy === 'in-range-only') {
    result = result.filter((update) => update.newValue === config.currentValue);
  }

  // Handle a weird edge case involving followTag and fallbacks
  if (config.rollbackPrs && config.followTag) {
    result = result.filter(
      (update) => update.updateType !== 'rollback' || result.length === 1,
    );
  }

  return result;
}
