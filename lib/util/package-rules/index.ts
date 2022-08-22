import is from '@sindresorhus/is';
import slugify from 'slugify';
import { mergeChildConfig } from '../../config';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import matchers from './matchers';
import { matcherOR } from './utils';

function matchesRule(
  inputConfig: PackageRuleInputConfig,
  packageRule: PackageRule
): boolean {
  let positiveMatch = true;
  let matchApplied = false;
  // matches
  for (const groupMatchers of matchers) {
    const isMatch = matcherOR(
      'matches',
      groupMatchers,
      inputConfig,
      packageRule
    );

    // no rules are defined
    if (is.nullOrUndefined(isMatch)) {
      continue;
    }

    matchApplied = true;

    if (!is.truthy(isMatch)) {
      positiveMatch = false;
    }
  }

  // not a single match rule is defined --> assume to match everything
  if (!matchApplied) {
    positiveMatch = true;
  }

  // nothing has been matched
  if (!positiveMatch) {
    return false;
  }

  // excludes
  for (const groupExcludes of matchers) {
    const isExclude = matcherOR(
      'excludes',
      groupExcludes,
      inputConfig,
      packageRule
    );

    // no rules are defined
    if (is.nullOrUndefined(isExclude)) {
      continue;
    }

    if (isExclude) {
      return false;
    }
  }

  return positiveMatch;
}

export function applyPackageRules<T extends PackageRuleInputConfig>(
  inputConfig: T
): T {
  let config = { ...inputConfig };
  const packageRules = config.packageRules ?? [];
  logger.trace(
    { dependency: config.depName, packageRules },
    `Checking against ${packageRules.length} packageRules`
  );
  for (const packageRule of packageRules) {
    // This rule is considered matched if there was at least one positive match and no negative matches
    if (matchesRule(config, packageRule)) {
      // Package rule config overrides any existing config
      const toApply = { ...packageRule };
      if (config.groupSlug && packageRule.groupName && !packageRule.groupSlug) {
        // Need to apply groupSlug otherwise the existing one will take precedence
        toApply.groupSlug = slugify(packageRule.groupName, {
          lower: true,
        });
      }
      config = mergeChildConfig(config, toApply);
      delete config.matchPackageNames;
      delete config.matchPackagePatterns;
      delete config.matchPackagePrefixes;
      delete config.excludePackageNames;
      delete config.excludePackagePatterns;
      delete config.excludePackagePrefixes;
      delete config.matchDepTypes;
      delete config.matchCurrentVersion;
    }
  }
  return config;
}
