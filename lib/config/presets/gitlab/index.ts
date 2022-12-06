import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { GitLabBranch } from '../../../types/platform/gitlab';
import { GitlabHttp } from '../../../util/http/gitlab';
import type { HttpResponse } from '../../../util/http/types';
import type { Preset, PresetConfig } from '../types';
import { PRESET_DEP_NOT_FOUND, fetchPreset, parsePreset } from '../util';

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
  tag?: string | null
): Promise<Preset> {
  let url = endpoint;
  let ref = '';
  let res: HttpResponse;
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
    res = await gitlabApi.get(url);
  } catch (err) {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.debug(`Preset file ${fileName} not found in ${repo}`);
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  return parsePreset(res.body);
}

export function getPresetFromEndpoint(
  repo: string,
  presetName: string,
  presetPath?: string,
  endpoint = Endpoint,
  tag?: string | null
): Promise<Preset | undefined> {
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
  tag = undefined,
}: PresetConfig): Promise<Preset | undefined> {
  return getPresetFromEndpoint(repo, presetName, presetPath, Endpoint, tag);
}
