const managerList = [
  'bazel',
  'buildkite',
  'cargo',
  'circleci',
  'composer',
  'docker-compose',
  'dockerfile',
  'gitlabci',
  'gomod',
  'kubernetes',
  'meteor',
  'bundler',
  'newmanager',
  'npm',
  'nvm',
  'pip_requirements',
  'pip_setup',
  'terraform',
  'travis',
  'nuget',
  'gradle',
];
const managers = {};
for (const manager of managerList) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  managers[manager] = require(`./${manager}`);
}

const languageList = [
  'docker',
  'golang',
  'js',
  'ruby',
  'newlanguage',
  'node',
  'php',
  'python',
  'rust',
];

const get = (manager, name) => managers[manager][name];
const getLanguageList = () => languageList;
const getManagerList = () => managerList;

module.exports = {
  get,
  getLanguageList,
  getManagerList,
};

const managerFunctions = [
  'extractAllPackageFiles',
  'extractPackageFile',
  'getPackageUpdates',
  'updateDependency',
  'supportsLockFileMaintenance',
];

for (const f of managerFunctions) {
  module.exports[f] = (manager, ...params) => {
    if (managers[manager][f]) {
      return managers[manager][f](...params);
    }
    return null;
  };
}

module.exports.getRangeStrategy = config => {
  const { manager, rangeStrategy } = config;
  if (managers[manager].getRangeStrategy) {
    // Use manager's own function if it exists
    return managers[manager].getRangeStrategy(config);
  }
  if (rangeStrategy === 'auto') {
    // default to 'replace' for auto
    return 'replace';
  }
  return config.rangeStrategy;
};
