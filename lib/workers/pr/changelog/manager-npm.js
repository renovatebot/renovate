const npmRegistry = require('../../../datasource/npm');

module.exports = {
  getPackage,
};

async function getPackage({ depName, depType }) {
  if (depType === 'engines') {
    return null;
  }
  const dep = await npmRegistry.getDependency(depName);
  if (!dep) {
    return null;
  }
  const versions = dep.releases.map(release => ({
    version: release.version,
    date: release.time,
    gitHead: release.gitRef,
  }));
  return {
    repositoryUrl: dep.repositoryUrl,
    versions,
  };
}
