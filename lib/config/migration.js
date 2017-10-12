const later = require('later');
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
    } else if (key === 'automergeMinor') {
      isMigrated = true;
      migratedConfig.minor = migratedConfig.minor || {};
      migratedConfig.minor.automerge = val == true; // eslint-disable-line eqeqeq
      delete migratedConfig[key];
    } else if (key === 'automergeMajor') {
      isMigrated = true;
      migratedConfig.major = migratedConfig.major || {};
      migratedConfig.major.automerge = val == true; // eslint-disable-line eqeqeq
      delete migratedConfig[key];
    } else if (key === 'automergePatch') {
      isMigrated = true;
      migratedConfig.patch = migratedConfig.patch || {};
      migratedConfig.patch.automerge = val == true; // eslint-disable-line eqeqeq
      delete migratedConfig[key];
    } else if (key === 'ignoreNodeModules') {
      isMigrated = true;
      delete migratedConfig.ignoreNodeModules;
      migratedConfig.ignorePaths = val ? ['node_modules/'] : [];
    } else if (key === 'semanticCommits') {
      if (parentConfig && parentConfig[key] === val) {
        isMigrated = true;
        delete migratedConfig[key];
      }
    } else if (
      key === 'automerge' &&
      typeof val === 'string' &&
      ['none', 'patch', 'minor', 'any'].indexOf(val) !== -1
    ) {
      delete migratedConfig.automerge;
      isMigrated = true;
      if (val === 'none') {
        migratedConfig.automerge = false;
      } else if (val === 'patch') {
        migratedConfig.patch = migratedConfig.patch || {};
        migratedConfig.patch.automerge = true;
        migratedConfig.minor = migratedConfig.minor || {};
        migratedConfig.minor.automerge = false;
        migratedConfig.major = migratedConfig.major || {};
        migratedConfig.major.automerge = false;
      } else if (val === 'minor') {
        migratedConfig.minor = migratedConfig.minor || {};
        migratedConfig.minor.automerge = true;
        migratedConfig.major = migratedConfig.major || {};
        migratedConfig.major.automerge = false;
      } else if (val === 'any') {
        migratedConfig.automerge = true;
      }
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
      // massage to array first
      const schedules = typeof val === 'string' ? [val] : val;
      // split 'and'
      for (let i = 0; i < schedules.length; i += 1) {
        if (
          schedules[i].includes(' and ') &&
          schedules[i].includes('before ') &&
          schedules[i].includes('after ')
        ) {
          const parsedSchedule = later.parse.text(
            // We need to massage short hours first before we can parse it
            schedules[i].replace(/( \d?\d)((a|p)m)/g, '$1:00$2')
          ).schedules[0];
          // Only migrate if the after time is greater than before, e.g. "after 10pm and before 5am"
          if (parsedSchedule && parsedSchedule.t_a[0] > parsedSchedule.t_b[0]) {
            isMigrated = true;
            const toSplit = schedules[i];
            schedules[i] = toSplit
              .replace(
                /^(after|before) (.*?) and (after|before) (.*?)( |$)(.*)/,
                '$1 $2 $6'
              )
              .trim();
            schedules.push(
              toSplit
                .replace(
                  /^(after|before) (.*?) and (after|before) (.*?)( |$)(.*)/,
                  '$3 $4 $6'
                )
                .trim()
            );
          }
        }
      }
      for (let i = 0; i < schedules.length; i += 1) {
        if (schedules[i].indexOf('on the last day of the month') !== -1) {
          isMigrated = true;
          schedules[i] = schedules[i].replace(
            'on the last day of the month',
            'on the first day of the month'
          );
        }
        if (schedules[i].indexOf('on every weekday') !== -1) {
          isMigrated = true;
          schedules[i] = schedules[i].replace(
            'on every weekday',
            'every weekday'
          );
        }
        if (
          schedules[i].match(/every (mon|tues|wednes|thurs|fri|satur|sun)day$/)
        ) {
          isMigrated = true;
          schedules[i] = schedules[i].replace(/every ([a-z]*day)$/, 'on $1');
        }
        if (schedules[i].endsWith('days')) {
          isMigrated = true;
          schedules[i] = schedules[i].replace('days', 'day');
        }
      }
      if (isMigrated) {
        if (typeof val === 'string' && schedules.length === 1) {
          [migratedConfig.schedule] = schedules;
        } else {
          migratedConfig.schedule = schedules;
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
            migratedConfig[depTypeName] = migrateConfig(depType).migratedConfig;
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
    } else if (
      optionTypes[key] === 'string' &&
      Array.isArray(val) &&
      val.length === 1
    ) {
      migratedConfig[key] = `${val[0]}`;
    } else if (isObject(val)) {
      const subMigrate = migrateConfig(val);
      if (subMigrate.isMigrated) {
        isMigrated = true;
        migratedConfig[key] = subMigrate.migratedConfig;
      }
    } else if (Array.isArray(val)) {
      migratedConfig[key] = [];
      for (const item of val) {
        if (isObject(item)) {
          const arrMigrate = migrateConfig(item);
          migratedConfig[key].push(arrMigrate.migratedConfig);
          if (arrMigrate.isMigrated) {
            isMigrated = true;
          }
        } else {
          migratedConfig[key].push(item);
        }
      }
    }
  }
  return { isMigrated, migratedConfig };
}

function isObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]';
}
