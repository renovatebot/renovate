import { PLATFORM_FAILURE } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { api } from '../../../platform/gitlab/gl-got-wrapper';
import type { GitLabBranch } from '../../../types/platform/gitlab';
import { Preset, PresetConfig } from '../common';
import { PRESET_DEP_NOT_FOUND, fetchPreset } from '../util';

export const Endpoint = 'https://gitlab.com/api/v4/';

async function getDefaultBranchName(
  urlEncodedPkgName: string,
  endpoint: string
): Promise<string> {
  const branchesUrl = `${endpoint}projects/${urlEncodedPkgName}/repository/branches`;

  const res = await api.get<GitLabBranch[]>(branchesUrl);
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

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string
): Promise<Preset> {
  try {
    const urlEncodedRepo = encodeURIComponent(repo);
    const urlEncodedPkgName = encodeURIComponent(fileName);
    const defautlBranchName = await getDefaultBranchName(
      urlEncodedRepo,
      endpoint
    );
    const url = `${endpoint}projects/${urlEncodedRepo}/repository/files/${urlEncodedPkgName}/raw?ref=${defautlBranchName}`;
    return (await api.get<Preset>(url)).body;
  } catch (err) {
    if (err.message === PLATFORM_FAILURE) {
      throw err;
    }
    logger.debug(
      { statusCode: err.statusCode },
      `Failed to retrieve ${fileName} from repo`
    );
    throw new Error(PRESET_DEP_NOT_FOUND);
  }
}

export async function getPresetFromEndpoint(
  pkgName: string,
  presetName: string,
  endpoint = Endpoint
): Promise<Preset> {
  return fetchPreset({
    pkgName,
    filePreset: presetName,
    endpoint,
    fetch: fetchJSONFile,
  });
}

export function getPreset({
  packageName: pkgName,
  presetName = 'default',
}: PresetConfig): Promise<Preset> {
  return getPresetFromEndpoint(pkgName, presetName, Endpoint);
}
