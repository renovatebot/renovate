import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import type { Nullish } from '../../../types/index.ts';
import { getRepoFile } from '../../../util/gitlab/files.ts';
import { GitlabHttp } from '../../../util/http/gitlab.ts';
import type { Preset, PresetConfig } from '../types.ts';
import { PRESET_DEP_NOT_FOUND, fetchPreset, parsePreset } from '../util.ts';

const gitlabApi = new GitlabHttp();
export const Endpoint = 'https://gitlab.com/api/v4/';

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string,
  tag?: string,
): Promise<Nullish<Preset>> {
  let content: string;
  try {
    content = await getRepoFile(
      gitlabApi,
      endpoint,
      encodeURIComponent(repo),
      fileName,
      tag,
    );
  } catch (err) {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.debug(
      `Preset file ${fileName} not found in ${repo}: ${err.message}`,
    );
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  return parsePreset(content, fileName);
}

export function getPresetFromEndpoint(
  repo: string,
  presetName: string,
  presetPath?: string,
  endpoint = Endpoint,
  tag?: string,
): Promise<Nullish<Preset>> {
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
  tag,
}: PresetConfig): Promise<Nullish<Preset>> {
  return getPresetFromEndpoint(repo, presetName, presetPath, Endpoint, tag);
}
