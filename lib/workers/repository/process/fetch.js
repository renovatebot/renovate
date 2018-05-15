const pAll = require('p-all');

const { getPackageUpdates } = require('../../../manager');
const { mergeChildConfig } = require('../../../config');
const { applyPackageRules } = require('../../../util/package-rules');
const { getManagerConfig } = require('../../../config');

module.exports = {
  fetchUpdates,
};

async function fetchDepUpdates(packageFileConfig, dep) {
  /* eslint-disable no-param-reassign */
  const { manager, packageFile } = packageFileConfig;
  const { depType, depName, currentVersion } = dep;
  let depConfig = mergeChildConfig(packageFileConfig, dep);
  depConfig = applyPackageRules(depConfig);
  dep.updates = [];
  if (depConfig.ignoreDeps.includes(depName)) {
    logger.debug({ depName: dep.depName }, 'Dependency is ignored');
    dep.skipReason = 'ignored';
  } else if (
    depConfig.internalPackages &&
    depConfig.internalPackages.includes(depName)
  ) {
    logger.debug(
      { depName: dep.depName },
      'Dependency is ignored as part of monorepo'
    );
    dep.skipReason = 'internal-package';
  } else if (depConfig.enabled === false) {
    logger.debug({ depName: dep.depName }, 'Dependency is disabled');
    dep.skipReason = 'disabled';
  } else {
    if (depConfig.pinVersions === null && !depConfig.upgradeInRange) {
      if (depType === 'devDependencies') {
        // Always pin devDependencies
        logger.debug({ depName }, 'Pinning devDependency');
        depConfig.pinVersions = true;
      }
      if (depType === 'dependencies' && depConfig.packageJsonType === 'app') {
        // Pin dependencies if we're pretty sure it's not a browser library
        logger.debug('Pinning app dependency');
        depConfig.pinVersions = true;
      }
    }
    dep.updates = await getPackageUpdates(manager, depConfig);
    logger.debug({
      packageFile,
      manager,
      depName,
      currentVersion,
      updates: dep.updates,
    });
  }
  /* eslint-enable no-param-reassign */
}

async function fetchManagerPackagerFileUpdates(config, managerConfig, pFile) {
  const packageFileConfig = mergeChildConfig(managerConfig, pFile);
  const queue = pFile.deps.map(dep => () =>
    fetchDepUpdates(packageFileConfig, dep)
  );
  await pAll(queue, { concurrency: 10 });
}

async function fetchManagerUpdates(config, packageFiles, manager) {
  const managerConfig = getManagerConfig(config, manager);
  const queue = packageFiles[manager].map(pFile => () =>
    fetchManagerPackagerFileUpdates(config, managerConfig, pFile)
  );
  await pAll(queue, { concurrency: 5 });
}

async function fetchUpdates(config, packageFiles) {
  logger.debug(`manager.fetchUpdates()`);
  const allManagerJobs = Object.keys(packageFiles).map(manager =>
    fetchManagerUpdates(config, packageFiles, manager)
  );
  await Promise.all(allManagerJobs);
}
