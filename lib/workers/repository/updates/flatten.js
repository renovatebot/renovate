const {
  getManagerConfig,
  mergeChildConfig,
  filterConfig,
} = require('../../../config');
const { applyPackageRules } = require('../../../util/package-rules');
const { get } = require('../../../manager');

module.exports = {
  flattenUpdates,
};

function flattenUpdates(config, packageFiles) {
  const updates = [];
  for (const [manager, files] of Object.entries(packageFiles)) {
    const managerConfig = getManagerConfig(config, manager);
    for (const packageFile of files) {
      const packageFileConfig = mergeChildConfig(managerConfig, packageFile);
      for (const dep of packageFile.deps) {
        if (dep.updates.length) {
          const depConfig = mergeChildConfig(packageFileConfig, dep);
          delete depConfig.deps;
          for (const update of dep.updates) {
            let updateConfig = mergeChildConfig(depConfig, update);
            delete updateConfig.updates;
            updateConfig = applyPackageRules(updateConfig);
            // apply major/minor/patch/pin/digest
            updateConfig = mergeChildConfig(
              updateConfig,
              updateConfig[updateConfig.type]
            );
            updateConfig = applyPackageRules(updateConfig);
            updateConfig.depNameSanitized = updateConfig.depName
              ? updateConfig.depName
                  .replace('@types/', '')
                  .replace('@', '')
                  .replace('/', '-')
                  .replace(/\s+/g, '-')
                  .toLowerCase()
              : undefined;
            if (
              updateConfig.language === 'docker' &&
              updateConfig.depName.match(/(^|\/)node$/)
            ) {
              updateConfig.managerBranchPrefix = '';
              updateConfig.depNameSanitized = 'node';
            }
            delete updateConfig.repoIsOnboarded;
            delete updateConfig.renovateJsonPresent;
            updates.push(updateConfig);
          }
        }
      }
    }
    if (
      get(manager, 'supportsLockFileMaintenance') &&
      managerConfig.lockFileMaintenance.enabled
    ) {
      const lockFileConfig = mergeChildConfig(
        managerConfig,
        managerConfig.lockFileMaintenance
      );
      lockFileConfig.type = 'lockFileMaintenance';
      updates.push(lockFileConfig);
    }
  }
  return updates
    .filter(update => update.enabled)
    .map(update => filterConfig(update, 'branch'));
}
