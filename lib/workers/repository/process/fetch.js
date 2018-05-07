const { get } = require('../../../manager');
const { mergeChildConfig } = require('../../../config');
const { applyPackageRules } = require('../../../util/package-rules');

module.exports = {
  fetchUpdates,
};

async function fetchUpdates(config, packageFiles) {
  logger.debug(`manager.fetchUpdates()`);
  for (const [manager, pFiles] of Object.entries(packageFiles)) {
    for (const pFile of pFiles) {
      const { packageFile } = pFile;
      const managerConfig = config[manager];
      const language = get(manager, 'language');
      const languageConfig = language ? config[language] : {};
      let packageFileConfig = config;
      packageFileConfig = mergeChildConfig(packageFileConfig, languageConfig);
      packageFileConfig = mergeChildConfig(packageFileConfig, managerConfig);
      packageFileConfig = mergeChildConfig(packageFileConfig, pFile);
      for (const dep of pFile.deps) {
        const { depName, currentVersion } = dep;
        let depConfig = mergeChildConfig(packageFileConfig, dep);
        depConfig = applyPackageRules(depConfig);
        dep.updates = [];
        if (depConfig.ignoreDeps.includes(depName)) {
          logger.debug({ depName: dep.depName }, 'Dependency is ignored');
          depConfig.skipReason = 'ignored';
        } else if (
          depConfig.monorepoPackages &&
          depConfig.monorepoPackages.includes(depName)
        ) {
          logger.debug(
            { depName: dep.depName },
            'Dependency is ignored as part of monorepo'
          );
          depConfig.skipReason = 'monorepo';
        } else if (depConfig.enabled === false) {
          logger.debug({ depName: dep.depName }, 'Dependency is disabled');
          depConfig.skipReason = 'disabled';
        } else {
          const getPackageUpdates = get(manager, 'getPackageUpdates');
          dep.updates = await getPackageUpdates(depConfig);
          logger.info({
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
