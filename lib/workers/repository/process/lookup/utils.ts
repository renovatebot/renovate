import is from '@sindresorhus/is';

import { getRangeStrategy } from '../../../../modules/manager';
import type { LookupUpdate } from '../../../../modules/manager/types';
import * as allVersioning from '../../../../modules/versioning';
import * as template from '../../../../util/template';
import type { LookupUpdateConfig } from './types';

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
    is.nonEmptyString(config.replacementName) ||
    is.nonEmptyString(config.replacementNameTemplate) ||
    is.nonEmptyString(config.replacementVersion) ||
    is.nonEmptyString(config.replacementVersionTemplate)
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
  if (!is.nullOrUndefined(config.replacementVersion)) {
    return config.replacementVersion;
  }
  if (!is.nullOrUndefined(config.replacementVersionTemplate)) {
    return template.compile(config.replacementVersionTemplate, config, true);
  }
  return null;
}
