import is from '@sindresorhus/is';
import slugify from 'slugify';
import { mergeChildConfig } from '../../config';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import matchers from './matchers';
import { matcherOR } from './utils';

function matchesRule(
  inputConfig: PackageRuleInputConfig,
  packageRule: PackageRule,
): boolean {
  let positiveMatch = true;
  let matchApplied = false;
  // matches
  for (const groupMatchers of matchers) {
    const isMatch = matcherOR(
      'matches',
      groupMatchers,
      inputConfig,
      packageRule,
    );

    // no rules are defined
    if (is.nullOrUndefined(isMatch)) {
      continue;
    }

    matchApplied = true;

    if (!is.truthy(isMatch)) {
      return false;
    }
  }

  // not a single match rule is defined --> assume to match everything
  if (!matchApplied) {
    positiveMatch = true;
  }

  // excludes
  for (const groupExcludes of matchers) {
    const isExclude = matcherOR(
      'excludes',
      groupExcludes,
      inputConfig,
      packageRule,
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
  inputConfig: T,
): T {
  let config = { ...inputConfig };
  const packageRules = config.packageRules ?? [];
  logger.trace(
    { dependency: config.depName, packageRules },
    `Checking against ${packageRules.length} packageRules`,
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
      delete config.matchCurrentValue;
      delete config.matchCurrentVersion;
      delete config.matchCurrentAge;
      delete config.excludeDepNames;
      delete config.excludeDepPatterns;
      delete config.excludeRepositories;
      delete config.matchCategories;
      delete config.matchRepositories;
      delete config.matchBaseBranches;
      delete config.matchManagers;
      delete config.matchDatasources;
      delete config.matchFileNames;
      delete config.matchDepNames;
      delete config.matchDepPatterns;
      delete config.matchSourceUrlPrefixes;
      delete config.matchSourceUrls;
      delete config.matchUpdateTypes;
      delete config.matchConfidence;
    }
  }
  return config;
}
