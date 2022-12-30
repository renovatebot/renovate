import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import type { MatchType, MatcherApi } from './types';

export function matcherOR(
  matchType: MatchType,
  groupMatchers: MatcherApi[],
  inputConfig: PackageRuleInputConfig,
  packageRule: PackageRule
): boolean | null {
  let positiveMatch = false;
  let matchApplied = false;
  for (const matcher of groupMatchers) {
    let isMatch;
    switch (matchType) {
      case 'excludes':
        isMatch = matcher.excludes(inputConfig, packageRule);
        break;
      case 'matches':
        isMatch = matcher.matches(inputConfig, packageRule);
        break;
    }

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

export function massagePattern(pattern: string): string {
  return pattern === '^*$' || pattern === '*' ? '.*' : pattern;
}
