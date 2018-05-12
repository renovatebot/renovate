const pAll = require('p-all');

const { getPackageUpdates } = require('../../../manager');
const { mergeChildConfig } = require('../../../config');
const { applyPackageRules } = require('../../../util/package-rules');
const { getManagerConfig } = require('../../../config');
const { parseRange } = require('../../../util/semver');

module.exports = {
  fetchUpdates,
};

async function fetchDepUpdates(packageFileConfig, dep) {
  /* eslint-disable no-param-reassign */
  const { manager, packageFile } = packageFileConfig;
  const { depName, currentVersion } = dep;
  let depConfig = mergeChildConfig(packageFileConfig, dep);
  depConfig = applyPackageRules(depConfig);
  dep.updates = [];
  if (depConfig.ignoreDeps.includes(depName)) {
    logger.debug({ depName: dep.depName }, 'Dependency is ignored');
    dep.skipReason = 'ignored';
  } else if (
    depConfig.monorepoPackages &&
    depConfig.monorepoPackages.includes(depName)
  ) {
    logger.debug(
      { depName: dep.depName },
      'Dependency is ignored as part of monorepo'
    );
    dep.skipReason = 'monorepo';
  } else if (depConfig.enabled === false) {
    logger.debug({ depName: dep.depName }, 'Dependency is disabled');
    dep.skipReason = 'disabled';
  } else {
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
