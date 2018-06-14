const nuget = require('../../../datasource/nuget');

module.exports = {
  getPackage,
};

async function getPackage({ depName, newVersion }) {
  const nuspec = await nuget.getNuspec(depName, newVersion);
  const repositoryUrl = getRepositoryUrl(nuspec);
  const versions = (await nuget.getVersions(depName)).map(v => ({
    version: v,
  }));

  return {
    repositoryUrl,
    versions,
  };
}

function getRepositoryUrl(nuspec) {
  if (
    nuspec &&
    nuspec.metadata &&
    nuspec.metadata.repository &&
    nuspec.metadata.repository['@_type'] === 'git' &&
    nuspec.metadata.repository['@_url'] !== undefined
  ) {
    return nuspec.metadata.repository['@_url'].replace('git://', 'https://');
  }
  return nuspec.metadata.projectUrl;
}
