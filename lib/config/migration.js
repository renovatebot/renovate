module.exports = {
  migrateConfig,
};

const removedOptions = [
  'maintainYarnLock',
  'yarnMaintenanceBranchName',
  'yarnMaintenanceCommitMessage',
  'yarnMaintenancePrTitle',
  'yarnMaintenancePrBody',
  'groupBranchName',
  'groupBranchName',
  'groupCommitMessage',
  'groupPrTitle',
  'groupPrBody',
];

// Returns a migrated config
function migrateConfig(config) {
  let isMigrated = false;
  const migratedConfig = Object.assign({}, config);
  for (const key of Object.keys(config)) {
    if (removedOptions.includes(key)) {
      isMigrated = true;
      delete migratedConfig[key];
    }
  }
  return { isMigrated, migratedConfig };
}
