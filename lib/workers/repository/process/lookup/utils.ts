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
    is.nonEmptyString(config.replacementVersion)
  );
}

export function determineNewReplacementName(
  config: LookupUpdateConfig,
): string {
  return (
    config.replacementName ??
    template.compile(config.replacementNameTemplate!, config, true)
  );
}

export function determineNewReplacementValue(
  config: LookupUpdateConfig,
): string | undefined | null {
  const versioning = allVersioning.get(config.versioning);
  const rangeStrategy = getRangeStrategy(config);

  if (!is.nullOrUndefined(config.replacementVersion)) {
    return versioning.getNewValue({
      // TODO #22198
      currentValue: config.currentValue!,
      newVersion: config.replacementVersion,
      rangeStrategy: rangeStrategy!,
      isReplacement: true,
    });
  }

  return config.currentValue;
}
