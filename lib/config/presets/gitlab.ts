import { api } from '../../platform/gitlab/gl-got-wrapper';
import { logger } from '../../logger';

const { get: glGot } = api;

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
): Promise<any> {
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
    logger.debug('Failed to parse renovate.json');
    throw new Error('invalid preset JSON');
  }
}
