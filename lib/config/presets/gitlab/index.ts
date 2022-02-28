import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { GitLabBranch } from '../../../types/platform/gitlab';
import { GitlabHttp } from '../../../util/http/gitlab';
import type { Preset, PresetConfig } from '../types';
import { PRESET_DEP_NOT_FOUND, fetchPreset } from '../util';

const gitlabApi = new GitlabHttp();
export const Endpoint = 'https://gitlab.com/api/v4/';

async function getDefaultBranchName(
  urlEncodedPkgName: string,
  endpoint: string
): Promise<string> {
  const branchesUrl = `${endpoint}projects/${urlEncodedPkgName}/repository/branches`;

  const res = await gitlabApi.getJson<GitLabBranch[]>(branchesUrl);
  const branches = res.body;
  let defaultBranchName = 'master';
  for (const branch of branches) {
    if (branch.default) {
      defaultBranchName = branch.name;
      break;
    }
  }

  return defaultBranchName;
}

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string,
  tag?: string
): Promise<Preset> {
  let url = endpoint;
  let ref = '';
  try {
    const urlEncodedRepo = encodeURIComponent(repo);
    const urlEncodedPkgName = encodeURIComponent(fileName);
    if (is.nonEmptyString(tag)) {
      ref = `?ref=${tag}`;
    } else {
      const defaultBranchName = await getDefaultBranchName(
        urlEncodedRepo,
        endpoint
      );
      ref = `?ref=${defaultBranchName}`;
    }
    url += `projects/${urlEncodedRepo}/repository/files/${urlEncodedPkgName}/raw${ref}`;
    logger.trace({ url }, `Preset URL`);
    return (await gitlabApi.getJson<Preset>(url)).body;
  } catch (err) {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.debug(
      { statusCode: err.statusCode, url },
      `Failed to retrieve ${fileName} from repo`
    );
    throw new Error(PRESET_DEP_NOT_FOUND);
  }
}

export function getPresetFromEndpoint(
  repo: string,
  presetName: string,
  presetPath: string,
  endpoint = Endpoint,
  tag?: string
): Promise<Preset> {
  return fetchPreset({
    repo,
    filePreset: presetName,
    presetPath,
    endpoint,
    tag,
    fetch: fetchJSONFile,
  });
}

export function getPreset({
  repo,
  presetPath,
  presetName = 'default',
  tag = null,
}: PresetConfig): Promise<Preset> {
  return getPresetFromEndpoint(repo, presetName, presetPath, Endpoint, tag);
}
