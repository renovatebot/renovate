const glGot = require('../../platform/gitlab/gl-got-wrapper');

module.exports = {
  getPreset,
  getPkgReleases,
};

async function getPreset(pkgName, presetName = 'default') {
  if (presetName !== 'default') {
    throw new Error(
      { pkgName, presetName },
      'Sub-preset names are not supported with Gitlab datasource'
    );
  }
  let res;
  try {
    const urlEncodedPkgName = encodeURIComponent(pkgName);
    const url = `https://gitlab.com/api/v4/projects/${urlEncodedPkgName}/repository/files/renovate.json?ref=master`;
    res = Buffer.from((await glGot(url)).body.content, 'base64').toString();
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
