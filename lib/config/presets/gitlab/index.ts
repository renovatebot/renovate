import { logger } from '../../../logger';
import { GitlabHttp } from '../../../util/http/gitlab';
import { ensureTrailingSlash } from '../../../util/url';
import { Preset, PresetConfig } from '../common';

const gitlabApi = new GitlabHttp();

async function getDefaultBranchName(
  urlEncodedPkgName: string,
  endpoint: string
): Promise<string> {
  const branchesUrl = `${endpoint}projects/${urlEncodedPkgName}/repository/branches`;
  type GlBranch = {
    default: boolean;
    name: string;
  }[];

  const res = await gitlabApi.getJson<GlBranch>(branchesUrl);
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

export async function getPresetFromEndpoint(
  pkgName: string,
  presetName: string,
  endpoint = 'https://gitlab.com/api/v4/'
): Promise<Preset> {
  // eslint-disable-next-line no-param-reassign
  endpoint = ensureTrailingSlash(endpoint);
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
    const defautlBranchName = await getDefaultBranchName(
      urlEncodedPkgName,
      endpoint
    );

    const presetUrl = `${endpoint}projects/${urlEncodedPkgName}/repository/files/renovate.json?ref=${defautlBranchName}`;
    res = Buffer.from(
      (await gitlabApi.getJson<{ content: string }>(presetUrl)).body.content,
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

export function getPreset({
  packageName: pkgName,
  presetName = 'default',
}: PresetConfig): Promise<Preset> {
  return getPresetFromEndpoint(pkgName, presetName);
}
