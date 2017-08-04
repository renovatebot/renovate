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
  const migratedConfig = { ...config };
  for (const key of Object.keys(config)) {
    const val = config[key];
    if (removedOptions.includes(key)) {
      isMigrated = true;
      delete migratedConfig[key];
    } else if (key === 'schedule' && typeof val === 'string') {
      isMigrated = true;
      migratedConfig.schedule = [val];
    } else if (key === 'packages') {
      isMigrated = true;
      migratedConfig.packageRules = migratedConfig.packages.map(
        p => migrateConfig(p).migratedConfig
      );
      delete migratedConfig.packages;
    } else if (key === 'packageName') {
      isMigrated = true;
      migratedConfig.packageNames = [val];
      delete migratedConfig.packageName;
    } else if (key === 'packagePattern') {
      isMigrated = true;
      migratedConfig.packagePatterns = [val];
      delete migratedConfig.packagePattern;
    } else if (
      typeof val === 'string' &&
      val.indexOf('{{semanticPrefix}}') === 0
    ) {
      isMigrated = true;
      migratedConfig[key] = val.replace('{{semanticPrefix}}', '');
    } else if (key === 'semanticPrefix') {
      console.log('Migrating semanticPrefix');
      // strip trailing space
      if (val && val[val.length - 1] === ' ') {
        isMigrated = true;
        migratedConfig[key] = val.substring(0, val.length - 1);
      }
    } else if (key === 'depTypes' && Array.isArray(val)) {
      val.forEach(depType => {
        if (isObject(depType)) {
          const depTypeName = depType.depType;
          if (depTypeName) {
            migratedConfig[depTypeName] = { ...depType };
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
