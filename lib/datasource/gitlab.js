const ghGot = require('../platform/github/gh-got-wrapper');

module.exports = {
  getPreset,
  getPkgReleases,
};

async function getPreset(pkgName, presetName = 'default') {
  if (presetName !== 'default') {
    throw new Error(
      { pkgName, presetName },
      'Sub-preset names are not supported with GitLab datasource'
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

/* eslint-disable no-unused-vars */
function getPkgReleases(purl, config) {}
/* eslint-enable no-unused-vars */
