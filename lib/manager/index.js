const managerList = [
  'ansible',
  'bazel',
  'buildkite',
  'bundler',
  'cargo',
  'circleci',
  'composer',
  'deps-edn',
  'docker-compose',
  'dockerfile',
  'github-actions',
  'gitlabci',
  'gomod',
  'gradle',
  'gradle-wrapper',
  'kubernetes',
  'leiningen',
  'maven',
  'meteor',
  'npm',
  'nuget',
  'nvm',
  'pip_requirements',
  'pip_setup',
  'pipenv',
  'poetry',
  'pub',
  'sbt',
  'swift',
  'terraform',
  'travis',
  'ruby-version',
  'homebrew',
  'helm',
];
const managers = {};
for (const manager of managerList) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  managers[manager] = require(`./${manager}`);
}

const languageList = [
  'dart',
  'docker',
  'dotnet',
  'golang',
  'js',
  'node',
  'php',
  'python',
  'ruby',
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
  'supportsLockFileMaintenance',
  'updateDependency',
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
