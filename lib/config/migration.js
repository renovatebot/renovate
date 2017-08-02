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
    const val = config[key];
    if (removedOptions.includes(key)) {
      isMigrated = true;
      delete migratedConfig[key];
    } else if (key === 'schedule' && typeof val === 'string') {
      isMigrated = true;
      migratedConfig.schedule = [val];
    } else if (key === 'depTypes' && Array.isArray(val)) {
      val.forEach(depType => {
        if (isObject(depType)) {
          const depTypeName = depType.depType;
          if (depTypeName) {
            migratedConfig[depTypeName] = Object.assign({}, depType);
            delete migratedConfig[depTypeName].depType;
          }
        }
      });
      isMigrated = true;
      delete migratedConfig.depTypes;
    } else if (isObject(val)) {
      const subMigrate = migrateConfig(val);
      if (subMigrate.isMigrated) {
        isMigrated = true;
        migratedConfig[key] = subMigrate.migratedConfig;
      }
    }
  }
  return { isMigrated, migratedConfig };
}

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
