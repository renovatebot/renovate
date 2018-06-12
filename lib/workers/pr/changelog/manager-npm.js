const npmRegistry = require('../../../datasource/npm');
const versioning = require('../../../versioning');

module.exports = {
  getPackage,
};

async function getPackage({ versionScheme, depName, depType }) {
  if (depType === 'engines') {
    return null;
  }
  const { sortVersions } = versioning(versionScheme);
  const dep = await npmRegistry.getDependency(depName);
  if (!dep) {
    return null;
  }
  const releases = Object.keys(dep.versions);
  releases.sort(sortVersions);
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
