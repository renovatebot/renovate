const npmRegistry = require('../../../datasource/npm');
const { semverSort } = require('../../../versioning/semver');

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
  const releases = Object.keys(dep.versions);
  releases.sort(semverSort);
  const versions = releases.map(release => ({
    version: release,
    date: dep.versions[release].time,
    gitHead: dep.versions[release].gitHead,
  }));
  return {
    repositoryUrl: dep.repositoryUrl,
    versions,
  };
}
