const glGot = require('../../platform/gitlab/gl-got-wrapper');

module.exports = {
  getPreset,
  getPkgReleases,
};

const GitLabApiUrl = 'https://gitlab.com/api/v4/projects';

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
    const defautlBranchName = await getDefaultBranchName(urlEncodedPkgName);

    const presetUrl = `${GitLabApiUrl}/${urlEncodedPkgName}/repository/files/renovate.json?ref=${defautlBranchName}`;
    res = Buffer.from(
      (await glGot(presetUrl)).body.content,
      'base64'
    ).toString();
  } catch (err) {
    logger.debug('Failed to retrieve renovate.json from repo');
    throw new Error('dep not found');
  }
  try {
    return JSON.parse(res);
  } catch (err) /* istanbul ignore next */ {
    logger.info('Failed to parse renovate.json');
    throw new Error('invalid preset JSON');
  }
}

// istanbul ignore next
function getPkgReleases() {}

async function getDefaultBranchName(urlEncodedPkgName) {
  const branchesUrl = `${GitLabApiUrl}/${urlEncodedPkgName}/repository/branches`;
  const res = await glGot(branchesUrl);
  const branches = res.body;
  let defautlBranchName = 'master';
  for (const branch of branches) {
    if (branch.default) {
      defautlBranchName = branch.name;
      break;
    }
  }

  return defautlBranchName;
}
