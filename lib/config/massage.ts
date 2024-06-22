import is from '@sindresorhus/is';
import { clone } from '../util/clone';
import { getOptions } from './options';
import type { PackageRule, RenovateConfig, UpdateType } from './types';

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
            massageConfig(item as RenovateConfig),
          );
        } else {
          (massagedConfig[key] as unknown[]).push(item);
        }
      });
    } else if (is.object(val) && key !== 'encrypted') {
      massagedConfig[key] = massageConfig(val as RenovateConfig);
    }
  }
  if (is.nonEmptyArray(massagedConfig.packageRules)) {
    let newRules: PackageRule[] = [];
    const updateTypes: UpdateType[] = [
      'major',
      'minor',
      'patch',
      'pin',
      'digest',
      'rollback',
    ];
    for (const rule of massagedConfig.packageRules) {
      newRules.push(rule);
      for (const [key, val] of Object.entries(rule) as [
        UpdateType,
        PackageRule,
      ][]) {
        if (updateTypes.includes(key)) {
          let newRule = clone(rule);
          Object.keys(newRule).forEach((newKey) => {
            if (!(newKey.startsWith(`match`) || newKey.startsWith('exclude'))) {
              delete newRule[newKey];
            }
          });
          newRule.matchUpdateTypes = rule.matchUpdateTypes ?? [];
          newRule.matchUpdateTypes.push(key);
          newRule = { ...newRule, ...val };
          newRules.push(newRule);
        }
      }
    }
    for (const rule of newRules) {
      updateTypes.forEach((updateType) => {
        delete rule[updateType];
      });
    }
    newRules = newRules.filter((rule) => {
      if (
        Object.keys(rule).every(
          (key) => key.startsWith('match') || key.startsWith('exclude'),
        )
      ) {
        // Exclude rules which contain only match or exclude options
        return false;
      }
      return true;
    });
    massagedConfig.packageRules = newRules;
  }
  return massagedConfig;
}
