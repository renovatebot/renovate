import { api } from '../../platform/gitlab/gl-got-wrapper';
import { logger } from '../../logger';
import { Preset } from './common';
import { ensureTrailingSlash } from '../../util/url';
import { RenovateConfig } from '../common';
import { PLATFORM_TYPE_GITLAB } from '../../constants/platforms';

const { get: glGot } = api;

async function getDefaultBranchName(
  urlEncodedPkgName: string,
  endpoint: string
): Promise<string> {
  const branchesUrl = `${endpoint}projects/${urlEncodedPkgName}/repository/branches`;
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
  presetName = 'default',
  baseConfig?: RenovateConfig
): Promise<Preset> {
  const endpoint = ensureTrailingSlash(
    (baseConfig?.platform === PLATFORM_TYPE_GITLAB
      ? baseConfig?.endpoint
      : null) ?? 'https://gitlab.com/api/v4/'
  );
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
