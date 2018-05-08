const { getPackageUpdates } = require('../../../manager');
const { mergeChildConfig } = require('../../../config');
const { applyPackageRules } = require('../../../util/package-rules');
const { getManagerConfig } = require('../../../config');

module.exports = {
  fetchUpdates,
};

async function fetchManagerPackagerFileUpdates(config, managerConfig, pFile) {
  const { packageFile } = pFile;
  const packageFileConfig = mergeChildConfig(managerConfig, pFile);
  for (const dep of pFile.deps) {
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
      dep.updates = await getPackageUpdates(managerConfig.manager, depConfig);
      logger.debug({
        packageFile,
        manager: managerConfig.manager,
        depName,
        currentVersion,
        updates: dep.updates,
      });
    }
  }
}

async function fetchManagerUpdates(config, packageFiles, manager) {
  const managerConfig = getManagerConfig(config, manager);
  for (const pFile of packageFiles[manager]) {
    await fetchManagerPackagerFileUpdates(config, managerConfig, pFile);
  }
}

async function fetchUpdates(config, packageFiles) {
  logger.debug(`manager.fetchUpdates()`);
  const allManagerJobs = Object.keys(packageFiles).map(manager =>
    fetchManagerUpdates(config, packageFiles, manager)
  );
  await Promise.all(allManagerJobs);
}
