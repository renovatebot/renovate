import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import type { MatchType, MatcherApi, MatcherApiAsync } from './types';

export async function matcherOR(
  matchType: MatchType,
  groupMatchers: (MatcherApi | MatcherApiAsync)[],
  inputConfig: PackageRuleInputConfig,
  packageRule: PackageRule
): Promise<boolean | null> {
  let matchApplied = false;
  for (const matcher of groupMatchers) {
    let isMatch;
    switch (matchType) {
      case 'excludes':
        isMatch = matcher.excludes(inputConfig, packageRule);
        if (is.promise(isMatch)) {
          isMatch = await isMatch;
        }
        break;
      case 'matches':
        isMatch = matcher.matches(inputConfig, packageRule);
        if (is.promise(isMatch)) {
          isMatch = await isMatch;
        }
        break;
    }

    // no rules are defined
    if (is.nullOrUndefined(isMatch)) {
      continue;
    }

    matchApplied = true;

    if (is.truthy(isMatch)) {
      return true;
    }
  }
  return matchApplied ? false : null;
}

export function massagePattern(pattern: string): string {
  return pattern === '^*$' || pattern === '*' ? '.*' : pattern;
}
