import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { GitlabProject } from '../../../types/platform/gitlab';
import { GitlabHttp } from '../../../util/http/gitlab';
import type { HttpResponse } from '../../../util/http/types';
import type { Preset, PresetConfig } from '../types';
import { PRESET_DEP_NOT_FOUND, fetchPreset, parsePreset } from '../util';

const gitlabApi = new GitlabHttp();
export const Endpoint = 'https://gitlab.com/api/v4/';

async function getDefaultBranchName(
  urlEncodedPkgName: string,
  endpoint: string,
): Promise<string> {
  const res = await gitlabApi.getJson<GitlabProject>(
    `${endpoint}projects/${urlEncodedPkgName}`,
  );
  return res.body.default_branch ?? 'master'; // should never happen, but we keep this to ensure the current behavior
}

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string,
  tag?: string | undefined,
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
        endpoint,
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

  return parsePreset(res.body, fileName);
}

export function getPresetFromEndpoint(
  repo: string,
  presetName: string,
  presetPath?: string,
  endpoint = Endpoint,
  tag?: string | undefined,
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
