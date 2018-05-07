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
    logger.debug(`flatten manager=${manager}`);
    const managerConfig = getManagerConfig(config, manager);
    logger.debug('Got manager config');
    for (const packageFile of files) {
      logger.debug('packageFile');
      const packageFileConfig = mergeChildConfig(managerConfig, packageFile);
      for (const dep of packageFile.deps) {
        logger.debug('dep ' + dep.depName);
        let depConfig = mergeChildConfig(packageFileConfig, dep);
        logger.debug('got depConfig');
        delete depConfig.deps;
        depConfig = applyPackageRules(depConfig);
        logger.debug('got depConfig with rules');
        for (const update of dep.updates) {
          logger.debug('update');
          let updateConfig = mergeChildConfig(depConfig, update);
          delete updateConfig.updates;
          // apply major/minor/patch/pin/digest
          updateConfig = mergeChildConfig(
            updateConfig,
            updateConfig[updateConfig.type]
          );
          updateConfig.depNameSanitized = updateConfig.depName
            ? updateConfig.depName
                .replace('@types/', '')
                .replace('@', '')
                .replace('/', '-')
                .replace(/\s+/g, '-')
                .toLowerCase()
            : undefined;
          delete updateConfig.repoIsOnboarded;
          delete updateConfig.renovateJsonPresent;
          updates.push(updateConfig);
        }
        logger.debug('Done dep');
      }
      logger.debug('Done packageFile');
    }
    logger.debug({ managerConfig });
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
  return updates.map(update => filterConfig(update, 'branch'));
}
