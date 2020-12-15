import minimatch from 'minimatch';
import { PackageRule, UpdateType, mergeChildConfig } from '../config';
import { logger } from '../logger';
import * as allVersioning from '../versioning';
import { configRegexPredicate, isConfigRegex, regEx } from './regex';

// TODO: move to `../config`
export interface Config extends Record<string, any> {
  versioning?: string;
  packageFile?: string;
  depType?: string;
  depTypes?: string[];
  depName?: string;
  currentValue?: string;
  fromVersion?: string;
  lockedVersion?: string;
  updateType?: UpdateType;
  isBump?: boolean;
  sourceUrl?: string;
  language?: string;
  baseBranch?: string;
  manager?: string;
  datasource?: string;
  packageRules?: (PackageRule & Config)[];
}

function matchesRule(inputConfig: Config, packageRule: PackageRule): boolean {
  const {
    versioning,
    packageFile,
    depType,
    depTypes,
    depName,
    currentValue,
    fromVersion,
    lockedVersion,
    updateType,
    isBump,
    sourceUrl,
    language,
    baseBranch,
    manager,
    datasource,
  } = inputConfig;
  let {
    paths,
    languages,
    baseBranchList,
    managers,
    datasources,
    depTypeList,
    packageNames,
    packagePatterns,
    excludePackageNames,
    excludePackagePatterns,
    matchCurrentVersion,
    sourceUrlPrefixes,
    updateTypes,
  } = packageRule;
  // Setting empty arrays simplifies our logic later
  paths = paths || [];
  languages = languages || [];
  baseBranchList = baseBranchList || [];
  managers = managers || [];
  datasources = datasources || [];
  depTypeList = depTypeList || [];
  packageNames = packageNames || [];
  packagePatterns = packagePatterns || [];
  excludePackageNames = excludePackageNames || [];
  excludePackagePatterns = excludePackagePatterns || [];
  sourceUrlPrefixes = sourceUrlPrefixes || [];
  matchCurrentVersion = matchCurrentVersion || null;
  updateTypes = updateTypes || [];
  let positiveMatch = false;
  // Massage a positive patterns patch if an exclude one is present
  if (
    (excludePackageNames.length || excludePackagePatterns.length) &&
    !(packageNames.length || packagePatterns.length)
  ) {
    packagePatterns = ['.*'];
  }
  if (paths.length) {
    const isMatch = paths.some(
      (rulePath) =>
        packageFile.includes(rulePath) ||
        minimatch(packageFile, rulePath, { dot: true })
    );
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (depTypeList.length) {
    const isMatch =
      depTypeList.includes(depType) ||
      depTypes?.some((dt) => depTypeList.includes(dt));
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (languages.length) {
    const isMatch = languages.includes(language);
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (baseBranchList.length) {
    const isMatch = baseBranchList.includes(baseBranch);
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (managers.length) {
    const isMatch = managers.includes(manager);
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (datasources.length) {
    const isMatch = datasources.includes(datasource);
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (updateTypes.length) {
    const isMatch =
      updateTypes.includes(updateType) ||
      (isBump && updateTypes.includes('bump'));
    if (!isMatch) {
      return false;
    }
    positiveMatch = true;
  }
  if (depName && (packageNames.length || packagePatterns.length)) {
    let isMatch = packageNames.includes(depName);
    // name match is "or" so we check patterns if we didn't match names
    if (!isMatch) {
      for (const packagePattern of packagePatterns) {
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
  if (sourceUrlPrefixes.length) {
    const isMatch = sourceUrlPrefixes.some((prefix) =>
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
          : lockedVersion || fromVersion; // need to match against this fromVersion, if available
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

export function applyPackageRules<T extends Config>(inputConfig: T): T {
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
      delete config.packageNames;
      delete config.packagePatterns;
      delete config.excludePackageNames;
      delete config.excludePackagePatterns;
      delete config.depTypeList;
      delete config.matchCurrentVersion;
    }
  });
  return config;
}
