const minimatch = require('minimatch');

const versioning = require('../versioning');
const { mergeChildConfig } = require('../config');

module.exports = {
  applyPackageRules,
};

function applyPackageRules(inputConfig) {
  let config = { ...inputConfig };
  const {
    versionScheme,
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
  } = config;
  const packageRules = config.packageRules || [];
  logger.trace(
    { dependency: depName, packageRules },
    `Checking against ${packageRules.length} packageRules`
  );
  packageRules.forEach(packageRule => {
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
    let negativeMatch = false;
    // Massage a positive patterns patch if an exclude one is present
    if (
      (excludePackageNames.length || excludePackagePatterns.length) &&
      !(packageNames.length || packagePatterns.length)
    ) {
      packagePatterns = ['.*'];
    }
    if (paths.length) {
      const isMatch = paths.some(
        rulePath =>
          packageFile.includes(rulePath) ||
          minimatch(packageFile, rulePath, { dot: true })
      );
      positiveMatch = positiveMatch || isMatch;
      negativeMatch = negativeMatch || !isMatch;
    }
    if (depTypeList.length) {
      const isMatch =
        depTypeList.includes(depType) ||
        (depTypes && depTypes.some(dt => depTypeList.includes(dt)));
      positiveMatch = positiveMatch || isMatch;
      negativeMatch = negativeMatch || !isMatch;
    }
    if (languages.length) {
      const isMatch = languages.includes(language);
      positiveMatch = positiveMatch || isMatch;
      negativeMatch = negativeMatch || !isMatch;
    }
    if (baseBranchList.length) {
      const isMatch = baseBranchList.includes(baseBranch);
      positiveMatch = positiveMatch || isMatch;
      negativeMatch = negativeMatch || !isMatch;
    }
    if (managers.length) {
      const isMatch = managers.includes(manager);
      positiveMatch = positiveMatch || isMatch;
      negativeMatch = negativeMatch || !isMatch;
    }
    if (datasources.length) {
      const isMatch = datasources.includes(datasource);
      positiveMatch = positiveMatch || isMatch;
      negativeMatch = negativeMatch || !isMatch;
    }
    if (updateTypes.length) {
      const isMatch =
        updateTypes.includes(updateType) ||
        (isBump && updateTypes.includes('bump'));
      positiveMatch = positiveMatch || isMatch;
      negativeMatch = negativeMatch || !isMatch;
    }
    if (packageNames.length || packagePatterns.length) {
      let isMatch = packageNames.includes(depName);
      // name match is "or" so we check patterns if we didn't match names
      if (!isMatch) {
        for (const packagePattern of packagePatterns) {
          const packageRegex = new RegExp(
            packagePattern === '^*$' || packagePattern === '*'
              ? '.*'
              : packagePattern
          );
          if (depName && depName.match(packageRegex)) {
            logger.trace(`${depName} matches against ${packageRegex}`);
            isMatch = true;
          }
        }
      }
      positiveMatch = positiveMatch || isMatch;
      negativeMatch = negativeMatch || !isMatch;
    }
    if (excludePackageNames.length) {
      const isMatch = excludePackageNames.includes(depName);
      negativeMatch = negativeMatch || isMatch;
      positiveMatch = positiveMatch || !isMatch;
    }
    if (excludePackagePatterns.length) {
      let isMatch = false;
      for (const pattern of excludePackagePatterns) {
        const packageRegex = new RegExp(
          pattern === '^*$' || pattern === '*' ? '.*' : pattern
        );
        if (depName && depName.match(packageRegex)) {
          logger.trace(`${depName} matches against ${packageRegex}`);
          isMatch = true;
        }
      }
      negativeMatch = negativeMatch || isMatch;
      positiveMatch = positiveMatch || !isMatch;
    }
    if (sourceUrlPrefixes.length) {
      const isMatch = sourceUrlPrefixes.some(
        prefix => sourceUrl && sourceUrl.startsWith(prefix)
      );
      positiveMatch = positiveMatch || isMatch;
      negativeMatch = negativeMatch || !isMatch;
    }
    if (matchCurrentVersion) {
      const { matches, isVersion } = versioning.get(versionScheme);
      const compareVersion =
        currentValue && isVersion(currentValue)
          ? currentValue // it's a version so we can match against it
          : lockedVersion || fromVersion; // need to match against this fromVersion, if available
      if (compareVersion) {
        const isMatch = matches(compareVersion, matchCurrentVersion);
        positiveMatch = positiveMatch || isMatch;
        negativeMatch = negativeMatch || !isMatch;
      } else {
        negativeMatch = true;
      }
    }
    // This rule is considered matched if there was at least one positive match and no negative matches
    if (positiveMatch && !negativeMatch) {
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
