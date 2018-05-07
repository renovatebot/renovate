const managerList = [
  'bazel',
  'buildkite',
  'circleci',
  'docker',
  'docker-compose',
  'meteor',
  'npm',
  'nvm',
  'pip_requirements',
  'travis',
];
const managers = {};
for (const manager of managerList) {
  // eslint-disable-next-line global-require,import/no-dynamic-require
  managers[manager] = require(`./${manager}`);
}

const languageList = ['node', 'python'];

const get = (manager, name) => managers[manager][name];
const getLanguageList = () => languageList;
const getManagerList = () => managerList;

function postExtract(manager, packageFiles) {
  if (managers[manager].postExtract) {
    return managers[manager].postExtract(packageFiles);
  }
  return null;
}

module.exports = {
  get,
  getLanguageList,
  getManagerList,
  postExtract,
};
