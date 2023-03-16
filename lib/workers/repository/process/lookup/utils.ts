import is from '@sindresorhus/is';

import { getRangeStrategy } from '../../../../modules/manager';
import type { LookupUpdate } from '../../../../modules/manager/types';
import * as allVersioning from '../../../../modules/versioning';
import * as template from '../../../../util/template';
import type { LookupUpdateConfig } from './types';

export function addReplacementUpdateIfValid(
  updates: LookupUpdate[],
  config: LookupUpdateConfig
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

export function isReplacementNameRulesConfigured(
  config: LookupUpdateConfig
): boolean {
  return (
    is.nonEmptyString(config.replacementName) ||
    is.nonEmptyString(config.replacementNameTemplate)
  );
}

export function isReplacementRulesConfigured(
  config: LookupUpdateConfig
): boolean {
  return (
    isReplacementNameRulesConfigured(config) ||
    is.nonEmptyString(config.replacementVersion)
  );
}

export function determineNewReplacementName(
  config: LookupUpdateConfig
): string {
  // TODO - Discuss in PR.  What fields should be supported within replacementNameTemplate (all or a subset)
  // TODO - Discuss in PR.  Where should packageNameWithoutRegistry be set?
  const content = {
    packageNameWithoutRegistry: getPackageNameWithoutRegistry(
      config.packageName
    ),
    ...config,
  };

  return (
    config.replacementName ??
    template.compile(config.replacementNameTemplate!, content, false)
  );
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

// TODO - This will move to the same place that packageNameWithoutRegistry moves to
function getPackageNameWithoutRegistry(packageName: string): string {
  const split = packageName.split('/');
  if (split.length > 1 && (split[0].includes('.') || split[0].includes(':'))) {
    split.shift();
    return split.join('/');
  }
  return packageName;
}
