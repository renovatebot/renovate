const { getPackageUpdates } = require('../../../manager');
const { mergeChildConfig } = require('../../../config');
const { applyPackageRules } = require('../../../util/package-rules');
const { getManagerConfig } = require('../../../config');

module.exports = {
  fetchUpdates,
};

async function fetchUpdates(config, packageFiles) {
  logger.debug(`manager.fetchUpdates()`);
  for (const [manager, pFiles] of Object.entries(packageFiles)) {
    for (const pFile of pFiles) {
      const { packageFile } = pFile;
      const managerConfig = getManagerConfig(config, manager);
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
          dep.updates = await getPackageUpdates(manager, depConfig);
          logger.debug({
            packageFile,
            manager,
            depName,
            currentVersion,
            updates: dep.updates,
          });
        }
      }
    }
  }
}
