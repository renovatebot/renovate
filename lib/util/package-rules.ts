import is from '@sindresorhus/is';
import minimatch from 'minimatch';
import { mergeChildConfig } from '../config';
import type { PackageRule, PackageRuleInputConfig } from '../config/types';
import { logger } from '../logger';
import * as allVersioning from '../versioning';
import { configRegexPredicate, isConfigRegex, regEx } from './regex';

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
    depName,
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
  // Setting empty arrays simplifies our logic later
  const matchFiles = packageRule.matchFiles || [];
  const matchPaths = packageRule.matchPaths || [];
  const matchLanguages = packageRule.matchLanguages || [];
  const matchBaseBranches = packageRule.matchBaseBranches || [];
  const matchManagers = packageRule.matchManagers || [];
  const matchDatasources = packageRule.matchDatasources || [];
  const matchDepTypes = packageRule.matchDepTypes || [];
  const matchPackageNames = packageRule.matchPackageNames || [];
  let matchPackagePatterns = packageRule.matchPackagePatterns || [];
  const matchPackagePrefixes = packageRule.matchPackagePrefixes || [];
  const excludePackageNames = packageRule.excludePackageNames || [];
  const excludePackagePatterns = packageRule.excludePackagePatterns || [];
  const excludePackagePrefixes = packageRule.excludePackagePrefixes || [];
  const matchSourceUrlPrefixes = packageRule.matchSourceUrlPrefixes || [];
  const matchCurrentVersion = packageRule.matchCurrentVersion || null;
  const matchUpdateTypes = packageRule.matchUpdateTypes || [];
  let positiveMatch = false;
  // Massage a positive patterns patch if an exclude one is present
  if (
    (excludePackageNames.length || excludePackagePatterns.length) &&
    !(matchPackageNames.length || matchPackagePatterns.length)
  ) {
    matchPackagePatterns = ['.*'];
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
  if (matchPaths.length) {
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
      matchDepTypes.includes(depType) ||
      depTypes?.some((dt) => matchDepTypes.includes(dt));
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchLanguages.length) {
    const isMatch = matchLanguages.includes(language);
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchBaseBranches.length) {
    const isMatch = matchBaseBranches.includes(baseBranch);
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchManagers.length) {
    const isMatch = matchManagers.includes(manager);
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchDatasources.length) {
    const isMatch = matchDatasources.includes(datasource);
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchUpdateTypes.length) {
    const isMatch =
      matchUpdateTypes.includes(updateType) ||
      (isBump && matchUpdateTypes.includes('bump'));
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (
    depName &&
    (matchPackageNames.length ||
      matchPackagePatterns.length ||
      matchPackagePrefixes.length)
  ) {
    let isMatch = matchPackageNames.includes(depName);
    // name match is "or" so we check patterns if we didn't match names
    if (!isMatch) {
      for (const packagePattern of matchPackagePatterns) {
        const packageRegex = regEx(
          packagePattern === '^*$' || packagePattern === '*'
            ? '.*'
            : packagePattern
        );
        if (packageRegex.test(depName)) {
          logger.trace(`${depName} matches against ${String(packageRegex)}`);
          isMatch = true;
        }
      }
    }
    // prefix match is also "or"
    if (!isMatch && matchPackagePrefixes.length) {
      isMatch = matchPackagePrefixes.some((prefix) =>
        depName.startsWith(prefix)
      );
    }
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (excludePackageNames.length) {
    const isMatch = excludePackageNames.includes(depName);
    if (isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (depName && excludePackagePatterns.length) {
    let isMatch = false;
    for (const pattern of excludePackagePatterns) {
      const packageRegex = regEx(
        pattern === '^*$' || pattern === '*' ? '.*' : pattern
      );
      if (packageRegex.test(depName)) {
        logger.trace(`${depName} matches against ${String(packageRegex)}`);
        isMatch = true;
      }
    }
    if (isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (depName && excludePackagePrefixes.length) {
    const isMatch = excludePackagePrefixes.some((prefix) =>
      depName.startsWith(prefix)
    );
    if (isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchSourceUrlPrefixes.length) {
    const isMatch = matchSourceUrlPrefixes.some((prefix) =>
      sourceUrl?.startsWith(prefix)
    );
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (matchCurrentVersion) {
    const version = allVersioning.get(versioning);
    const matchCurrentVersionStr = matchCurrentVersion.toString();
    if (isConfigRegex(matchCurrentVersionStr)) {
      const matches = configRegexPredicate(matchCurrentVersionStr);
      if (!matches(currentValue)) {
        return false;
      }
      positiveMatch = true;
    } else if (version.isVersion(matchCurrentVersionStr)) {
      let isMatch = false;
      try {
        isMatch = version.matches(matchCurrentVersionStr, currentValue);
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
          : lockedVersion || currentVersion; // need to match against this currentVersion, if available
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
  const packageRules = config.packageRules || [];
  logger.trace(
    { dependency: config.depName, packageRules },
    `Checking against ${packageRules.length} packageRules`
  );
  packageRules.forEach((packageRule) => {
    // This rule is considered matched if there was at least one positive match and no negative matches
    if (matchesRule(config, packageRule)) {
      // Package rule config overrides any existing config
      config = mergeChildConfig(config, packageRule);
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
