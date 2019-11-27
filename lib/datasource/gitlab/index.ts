import is from '@sindresorhus/is';
import { api } from '../../platform/gitlab/gl-got-wrapper';
import { logger } from '../../logger';
import { PkgReleaseConfig, ReleaseResult, Preset } from '../common';

const glGot = api.get;

const GitLabApiUrl = 'https://gitlab.com/api/v4/projects';

async function getDefaultBranchName(
  urlEncodedPkgName: string
): Promise<string> {
  const branchesUrl = `${GitLabApiUrl}/${urlEncodedPkgName}/repository/branches`;
  type GlBranch = {
    default: boolean;
    name: string;
  }[];

  const res = await glGot<GlBranch>(branchesUrl);
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

export async function getPreset(
  pkgName: string,
  presetName = 'default'
): Promise<Preset> {
  if (presetName !== 'default') {
    // TODO: proper error contructor
    throw new Error(
      // { pkgName, presetName },
      'Sub-preset names are not supported with Gitlab datasource'
    );
  }
  let res: string;
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
function getCacheKey(
  depHost: string,
  repo: string,
  lookupType: string
): string {
  const type = lookupType || 'tags';
  return `${depHost}:${repo}:${type}`;
}

export async function getPkgReleases({
  registryUrls,
  lookupName: repo,
  lookupType,
}: PkgReleaseConfig): Promise<ReleaseResult | null> {
  // Use registryUrls if present, otherwise default to publid gitlab.com
  const depHost = is.nonEmptyArray(registryUrls)
    ? registryUrls[0].replace(/\/$/, '')
    : 'https://gitlab.com';
  let versions: string[];
  const cachedResult = await renovateCache.get<ReleaseResult>(
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
      type GlRelease = {
        tag_name: string;
      }[];

      versions = (await glGot<GlRelease>(url, {
        paginate: true,
      })).body.map(o => o.tag_name);
    } else {
      // tag
      const url = `${depHost}/api/v4/projects/${urlEncodedRepo}/repository/tags?per_page=100`;
      type GlTag = {
        name: string;
      }[];

      versions = (await glGot<GlTag>(url, {
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

  const dependency: ReleaseResult = {
    sourceUrl: `${depHost}/${repo}`,
    releases: null,
  };
  dependency.releases = versions.map(version => ({
    version,
    gitRef: version,
  }));

  const cacheMinutes = 10;
  await renovateCache.set(
    cacheNamespace,
    getCacheKey(depHost, repo, lookupType),
    dependency,
    cacheMinutes
  );
  return dependency;
}
