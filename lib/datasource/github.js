const ghGot = require('../platform/github/gh-got-wrapper');
const versioning = require('../versioning');

module.exports = {
  getPreset,
  getPkgReleases,
};

async function getPreset(pkgName, presetName = 'default') {
  if (presetName !== 'default') {
    throw new Error(
      { pkgName, presetName },
      'Sub-preset names are not supported with GitHub datasource'
    );
  }
  let res;
  try {
    const url = `https://api.github.com/repos/${pkgName}/contents/renovate.json`;
    res = Buffer.from((await ghGot(url)).body.content, 'base64').toString();
  } catch (err) {
    logger.debug('Failed to retrieve renovate.json from repo');
    throw new Error('dep not found');
  }
  try {
    return JSON.parse(res);
  } catch (err) {
    logger.debug('Failed to parse renovate.json');
    throw new Error('invalid preset JSON');
  }
}

async function getPkgReleases(purl, config) {
  const { versionScheme } = config || {};
  const { fullname: repo, qualifiers: options } = purl;
  let versions;
  try {
    if (options.ref === 'release') {
      const url = `https://api.github.com/repos/${repo}/releases?per_page=100`;
      versions = (await ghGot(url, { paginate: true })).body.map(
        o => o.tag_name
      );
    } else {
      // tag
      const url = `https://api.github.com/repos/${repo}/tags?per_page=100`;
      versions = (await ghGot(url, { paginate: true })).body.map(o => o.name);
    }
  } catch (err) {
    logger.info(
      { repo, err, message: err.message },
      'Error retrieving from github'
    );
  }
  if (!versions) {
    return null;
  }
  // Filter by semver if no versionScheme provided
  const { isVersion, sortVersions } = versioning(versionScheme);
  // Return a sorted list of valid Versions
  versions = versions.filter(isVersion).sort(sortVersions);
  const dependency = {
    repositoryUrl: 'https://github.com/' + repo,
  };
  dependency.releases = versions.map(version => ({
    version: options.sanitize === 'true' ? isVersion(version) : version,
    gitRef: version,
  }));
  return dependency;
}
