const is = require('@sindresorhus/is').default;

const glGot = require('../../platform/gitlab/gl-got-wrapper').api.get;
const { logger } = require('../../logger');

module.exports = {
  getPreset,
  getPkgReleases,
};

const GitLabApiUrl = 'https://gitlab.com/api/v4/projects';

async function getPreset(pkgName, presetName = 'default') {
  if (presetName !== 'default') {
    throw new Error(
      { pkgName, presetName },
      // @ts-ignore
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
    logger.debug({ err }, 'Failed to retrieve renovate.json from repo');
    throw new Error('dep not found');
  }
  try {
    return JSON.parse(res);
  } catch (err) /* istanbul ignore next */ {
    logger.info('Failed to parse renovate.json');
    throw new Error('invalid preset JSON');
  }
}

const cacheNamespace = 'datasource-gitlab';
function getCacheKey(depHost, repo, lookupType) {
  const type = lookupType || 'tags';
  return `${depHost}:${repo}:${type}`;
}

/**
 *
 * @param {{registryUrls? : string[], lookupName:string, lookupType:string}} param0
 */
async function getPkgReleases({ registryUrls, lookupName: repo, lookupType }) {
  // Use registryUrls if present, otherwise default to publid gitlab.com
  const depHost = is.nonEmptyArray(registryUrls)
    ? registryUrls[0].replace(/\/$/, '')
    : 'https://gitlab.com';
  let versions;
  const cachedResult = await renovateCache.get(
    cacheNamespace,
    getCacheKey(depHost, repo, lookupType)
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  const urlEncodedRepo = encodeURIComponent(repo);

  try {
    if (lookupType === 'releases') {
      const url = `${depHost}/api/v4/projects/${urlEncodedRepo}/releases?per_page=100`;
      versions = (await glGot(url, { paginate: true })).body.map(
        o => o.tag_name
      );
    } else {
      // tag
      const url = `${depHost}/api/v4/projects/${urlEncodedRepo}/repository/tags?per_page=100`;
      versions = (await glGot(url, {
        paginate: true,
      })).body.map(o => o.name);
    }
  } catch (err) {
    // istanbul ignore next
    logger.info({ repo, err }, 'Error retrieving from Gitlab');
  }

  // istanbul ignore if
  if (!versions) {
    return null;
  }

  const dependency = {
    sourceUrl: `${depHost}/${repo}`,
  };
  dependency.releases = versions.map(version => ({
    version,
    gitRef: version,
  }));

  const cacheMinutes = 10;
  await renovateCache.set(
    cacheNamespace,
    getCacheKey(depHost, repo, lookupType),
    versions,
    cacheMinutes
  );
  return dependency;
}

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
