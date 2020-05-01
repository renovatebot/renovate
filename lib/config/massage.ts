import is from '@sindresorhus/is';
import { clone } from '../util/clone';
import { PackageRule, RenovateConfig, UpdateType } from './common';
import { getOptions } from './definitions';

const options = getOptions();

let allowedStrings: string[];

// Returns a massaged config
export function massageConfig(config: RenovateConfig): RenovateConfig {
  if (!allowedStrings) {
    allowedStrings = [];
    options.forEach((option) => {
      if (option.allowString) {
        allowedStrings.push(option.name);
      }
    });
  }
  const massagedConfig = clone(config);
  for (const [key, val] of Object.entries(config)) {
    if (allowedStrings.includes(key) && is.string(val)) {
      massagedConfig[key] = [val];
    } else if (key === 'npmToken' && is.string(val) && val.length < 50) {
      massagedConfig.npmrc = `//registry.npmjs.org/:_authToken=${val}\n`;
      delete massagedConfig.npmToken;
    } else if (is.array(val)) {
      massagedConfig[key] = [];
      val.forEach((item) => {
        if (is.object(item)) {
          (massagedConfig[key] as RenovateConfig[]).push(
            massageConfig(item as RenovateConfig)
          );
        } else {
          (massagedConfig[key] as RenovateConfig[]).push(item);
        }
      });
    } else if (is.object(val) && key !== 'encrypted') {
      massagedConfig[key] = massageConfig(val as RenovateConfig);
    }
  }
  if (is.nonEmptyArray(massagedConfig.packageRules)) {
    const newRules: PackageRule[] = [];
    const updateTypes: UpdateType[] = [
      'major',
      'minor',
      'patch',
      'pin',
      'digest',
      'lockFileMaintenance',
      'rollback',
    ];
    for (const rule of massagedConfig.packageRules) {
      newRules.push(rule);
      for (const [key, val] of Object.entries(rule) as [
        UpdateType,
        PackageRule
      ][]) {
        if (updateTypes.includes(key)) {
          const newRule = clone(rule);
          newRule.updateTypes = rule.updateTypes || [];
          newRule.updateTypes.push(key);
          Object.assign(newRule, val);
          newRules.push(newRule);
        }
      }
    }
    for (const rule of newRules) {
      updateTypes.forEach((updateType) => {
        delete rule[updateType];
      });
    }
    massagedConfig.packageRules = newRules;
  }
  return massagedConfig;
}
