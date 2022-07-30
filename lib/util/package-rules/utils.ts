import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import type { MatcherApi } from './types';

export function matchOR(
  groupMatchers: MatcherApi[],
  inputConfig: PackageRuleInputConfig,
  packageRule: PackageRule
): boolean | null {
  let positiveMatch = false;
  let matchApplied = false;
  for (const matcher of groupMatchers) {
    const isMatch = matcher.matches(inputConfig, packageRule);

    // no rules are defined
    if (is.nullOrUndefined(isMatch)) {
      continue;
    }

    matchApplied = true;

    if (is.truthy(isMatch)) {
      positiveMatch = true;
    }
  }
  return matchApplied ? positiveMatch : null;
}

export function excludeOR(
  groupMatchers: MatcherApi[],
  inputConfig: PackageRuleInputConfig,
  packageRule: PackageRule
): boolean | null {
  let positiveMatch = false;
  let matchApplied = false;
  for (const matcher of groupMatchers) {
    const isMatch = matcher.excludes(inputConfig, packageRule);

    // no rules are defined
    if (is.nullOrUndefined(isMatch)) {
      continue;
    }

    matchApplied = true;

    if (is.truthy(isMatch)) {
      positiveMatch = true;
    }
  }
  return matchApplied ? positiveMatch : null;
}
