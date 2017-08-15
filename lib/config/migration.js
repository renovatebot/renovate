const options = require('./definitions').getOptions();

const optionTypes = {};
options.forEach(option => {
  optionTypes[option.name] = option.type;
});

module.exports = {
  migrateConfig,
};

const removedOptions = [
  'maintainYarnLock',
  'yarnCacheFolder',
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
function migrateConfig(config, parentConfig) {
  let isMigrated = false;
  const migratedConfig = { ...config };
  for (const key of Object.keys(config)) {
    const val = config[key];
    if (removedOptions.includes(key)) {
      isMigrated = true;
      delete migratedConfig[key];
    } else if (key === 'semanticCommits') {
      if (parentConfig && parentConfig[key] === val) {
        isMigrated = true;
        delete migratedConfig[key];
      }
    } else if (key === 'automerge' && val === false) {
      isMigrated = true;
      migratedConfig.automerge = 'none';
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
    } else if (key === 'schedule') {
      for (let i = 0; i < val.length; i += 1) {
        if (val[i].indexOf('on the last day of the month') !== -1) {
          isMigrated = true;
          migratedConfig.schedule[i] = val[i].replace(
            'on the last day of the month',
            'on the first day of the month'
          );
        }
      }
    } else if (
      typeof val === 'string' &&
      val.indexOf('{{semanticPrefix}}') === 0
    ) {
      isMigrated = true;
      migratedConfig[key] = val.replace('{{semanticPrefix}}', '');
    } else if (key === 'semanticPrefix') {
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
    } else if (optionTypes[key] === 'boolean') {
      if (val === 'true') {
        migratedConfig[key] = true;
      } else if (val === 'false') {
        migratedConfig[key] = false;
      }
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
