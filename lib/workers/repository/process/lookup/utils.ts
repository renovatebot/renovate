import is from '@sindresorhus/is';

import { getRangeStrategy } from '../../../../modules/manager';
import type { LookupUpdate } from '../../../../modules/manager/types';
import * as allVersioning from '../../../../modules/versioning';
import type { LookupUpdateConfig } from './types';

export function addReplacementUpdateIfValid(
  updates: LookupUpdate[],
  config: LookupUpdateConfig
): void {
  const replacementNewName = determineNewReplacementName(config);
  const replacementNewVValue = determineNewReplacementValue(config);

  if (
    config.packageName !== replacementNewName ||
    config.currentValue !== replacementNewVValue
  ) {
    updates.push({
      updateType: 'replacement',
      newName: replacementNewName,
      newValue: replacementNewVValue!,
    });
  }
}

export function isReplacementNameRulesConfigured(
  config: LookupUpdateConfig
): boolean {
  return (
    !is.nullOrUndefined(config.replacementName) ||
    !is.nullOrUndefined(config.replacementPrefixAdd) ||
    !is.nullOrUndefined(config.replacementPrefixRemove)
  );
}

export function isReplacementRulesConfigured(
  config: LookupUpdateConfig
): boolean {
  return (
    isReplacementNameRulesConfigured(config) ||
    !is.nullOrUndefined(config.replacementVersion)
  );
}

export function determineNewReplacementName(
  config: LookupUpdateConfig
): string {
  let replacementNewName = config.packageName;

  if (config.replacementName) {
    replacementNewName = config.replacementName;
  }

  if (
    config.replacementPrefixRemove &&
    replacementNewName.startsWith(config.replacementPrefixRemove)
  ) {
    replacementNewName = replacementNewName.replace(
      config.replacementPrefixRemove,
      ''
    );
  }

  if (config.replacementPrefixAdd) {
    replacementNewName = `${config.replacementPrefixAdd}${replacementNewName}`;
  }

  return replacementNewName;
}

export function determineNewReplacementValue(
  config: LookupUpdateConfig
): string | undefined {
  const versioning = allVersioning.get(config.versioning);
  const rangeStrategy = getRangeStrategy(config);

  if (!is.nullOrUndefined(config.replacementVersion)) {
    return versioning.getNewValue({
      // TODO #7154
      currentValue: config.currentValue!,
      newVersion: config.replacementVersion,
      rangeStrategy: rangeStrategy!,
      isReplacement: true,
    })!;
  }

  return config.currentValue;
}
