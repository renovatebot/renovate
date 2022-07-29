import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import slugify from 'slugify';
import { mergeChildConfig } from '../../config';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { logger } from '../../logger';
import * as allVersioning from '../../modules/versioning';
import { configRegexPredicate } from '../regex';
import matchers from './api';
import type { MatcherApi } from './types';

export const getMatchers = (): Map<string, MatcherApi> => matchers;
export const getMatcherList = (): string[] => Array.from(matchers.keys());

function matchesRule(
  inputConfig: PackageRuleInputConfig,
  packageRule: PackageRule
): boolean {
  const {
    versioning,
    packageFile,
    lockFiles,
    depType,
    depTypes,
    currentValue,
    currentVersion,
    lockedVersion,
    updateType,
    isBump,
    sourceUrl,
    language,
    baseBranch,
    manager,
    datasource,
  } = inputConfig;
  const unconstrainedValue = !!lockedVersion && is.undefined(currentValue);
  // Setting empty arrays simplifies our logic later
  const matchFiles = packageRule.matchFiles ?? [];
  const matchPaths = packageRule.matchPaths ?? [];
  const matchLanguages = packageRule.matchLanguages ?? [];
  const matchBaseBranches = packageRule.matchBaseBranches ?? [];
  const matchManagers = packageRule.matchManagers ?? [];
  const matchDatasources = packageRule.matchDatasources ?? [];
  const matchDepTypes = packageRule.matchDepTypes ?? [];
  const matchSourceUrlPrefixes = packageRule.matchSourceUrlPrefixes ?? [];
  const matchSourceUrls = packageRule.matchSourceUrls ?? [];
  const matchCurrentVersion = packageRule.matchCurrentVersion ?? null;
  const matchUpdateTypes = packageRule.matchUpdateTypes ?? [];

  let positiveMatch = false;
  let matchApplied = false;
  for (const [, matcher] of getMatchers()) {
    const isMatch = matcher.matches(inputConfig, packageRule);

    // no rules are defined
    if (is.nullOrUndefined(isMatch)) {
      continue;
    }

    matchApplied = true;

    // mark that one of the rules has matched
    if (isMatch) {
      positiveMatch = true;
    }
  }

  // not a single match rule is defined assume match everything
  if (!matchApplied) {
    positiveMatch = true;
  }

  if (matchFiles.length) {
    const isMatch = matchFiles.some(
      (fileName) =>
        packageFile === fileName ||
        (is.array(lockFiles) && lockFiles?.includes(fileName))
    );
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchPaths.length && packageFile) {
    const isMatch = matchPaths.some(
      (rulePath) =>
        packageFile.includes(rulePath) ||
        minimatch(packageFile, rulePath, { dot: true })
    );
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchDepTypes.length) {
    const isMatch =
      (depType && matchDepTypes.includes(depType)) ||
      depTypes?.some((dt) => matchDepTypes.includes(dt));
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchLanguages.length) {
    if (!language) {
      return false;
    }
    const isMatch = matchLanguages.includes(language);
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchBaseBranches.length) {
    if (!baseBranch) {
      return false;
    }
    const isMatch = matchBaseBranches.some((matchBaseBranch): boolean => {
      const isAllowedPred = configRegexPredicate(matchBaseBranch);
      if (isAllowedPred) {
        return isAllowedPred(baseBranch);
      }
      return matchBaseBranch === baseBranch;
    });

    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchManagers.length) {
    if (!manager) {
      return false;
    }
    const isMatch = matchManagers.includes(manager);
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchDatasources.length) {
    if (!datasource) {
      return false;
    }
    const isMatch = matchDatasources.includes(datasource);
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchUpdateTypes.length) {
    const isMatch =
      (updateType && matchUpdateTypes.includes(updateType)) ||
      (isBump && matchUpdateTypes.includes('bump'));
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }

  for (const [, matcher] of getMatchers()) {
    const isExclude = matcher.excludes(inputConfig, packageRule);

    // no rules are defined
    if (is.nullOrUndefined(isExclude)) {
      continue;
    }

    if (isExclude) {
      return false;
    }
  }

  if (matchSourceUrlPrefixes.length) {
    const upperCaseSourceUrl = sourceUrl?.toUpperCase();
    const isMatch = matchSourceUrlPrefixes.some((prefix) =>
      upperCaseSourceUrl?.startsWith(prefix.toUpperCase())
    );
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchSourceUrls.length) {
    const upperCaseSourceUrl = sourceUrl?.toUpperCase();
    const isMatch = matchSourceUrls.some(
      (url) => upperCaseSourceUrl === url.toUpperCase()
    );
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchCurrentVersion) {
    const version = allVersioning.get(versioning);
    const matchCurrentVersionStr = matchCurrentVersion.toString();
    const matchCurrentVersionPred = configRegexPredicate(
      matchCurrentVersionStr
    );
    if (matchCurrentVersionPred) {
      if (
        !unconstrainedValue &&
        (!currentValue || !matchCurrentVersionPred(currentValue))
      ) {
        return false;
      }
      positiveMatch = true;
    } else if (version.isVersion(matchCurrentVersionStr)) {
      let isMatch = false;
      try {
        isMatch =
          unconstrainedValue ||
          !!(
            currentValue &&
            version.matches(matchCurrentVersionStr, currentValue)
          );
      } catch (err) {
        // Do nothing
      }
      if (!isMatch) {
        return false;
      }
      positiveMatch = true;
    } else {
      const compareVersion =
        currentValue && version.isVersion(currentValue)
          ? currentValue // it's a version so we can match against it
          : lockedVersion ?? currentVersion; // need to match against this currentVersion, if available
      if (compareVersion) {
        // istanbul ignore next
        if (version.isVersion(compareVersion)) {
          const isMatch = version.matches(compareVersion, matchCurrentVersion);
          // istanbul ignore if
          if (!isMatch) {
            return false;
          }
          positiveMatch = true;
        } else {
          return false;
        }
      } else {
        logger.debug(
          { matchCurrentVersionStr, currentValue },
          'Could not find a version to compare'
        );
        return false;
      }
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
  packageRules.forEach((packageRule) => {
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
  });
  return config;
}
