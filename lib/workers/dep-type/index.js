const configParser = require('../../config');
const dependencyWorker = require('../dependency');

module.exports = {
  extractDependencies,
  getUpgrades,
};

// Returns an array of current dependencyList
function extractDependencies(packageJson, depTypeConfig) {
  const packageDependencies = packageJson[depTypeConfig.depType];
  if (!packageDependencies) {
    return [];
  }
  const dependencyList = [];
  for (const dependency of Object.keys(packageDependencies)) {
    const ignoreDep = depTypeConfig.ignoreDeps.indexOf(dependency) !== -1;
    if (!ignoreDep) {
      const packageConfig = configParser.getPackageConfig(
        depTypeConfig,
        dependency
      );
      packageConfig.currentVersion = packageDependencies[dependency].trim();
      dependencyList.push(packageConfig);
    }
  }
  return dependencyList;
}

function getUpgrades(packageJson, depTypeConfig) {
  const depConfigs = module.exports.extractDependencies(
    packageJson,
    depTypeConfig
  );
  return dependencyWorker.findUpgrades(depConfigs);
}
