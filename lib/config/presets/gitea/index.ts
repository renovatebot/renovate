import { logger } from '../../../logger';
import { getRepoContents } from '../../../modules/platform/gitea/gitea-helper';
import type { RepoContents } from '../../../modules/platform/gitea/types';
import type { Nullish } from '../../../types';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { Preset, PresetConfig } from '../types';
import { PRESET_DEP_NOT_FOUND, fetchPreset, parsePreset } from '../util';

export const Endpoint = 'https://gitea.com/';

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string,
  tag?: string | null,
): Promise<Nullish<Preset>> {
  let res: RepoContents;
  try {
    res = await getRepoContents(repo, fileName, tag, {
      baseUrl: endpoint,
    });
  } catch (err) {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.debug(
      `Preset file ${fileName} not found in ${repo}: ${err.message}`,
    );
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  return parsePreset(res.contentString, fileName);
}

export function getPresetFromEndpoint(
  repo: string,
  filePreset: string,
  presetPath?: string,
  endpoint = Endpoint,
  tag?: string,
): Promise<Nullish<Preset>> {
  return fetchPreset({
    repo,
    filePreset,
    presetPath,
    endpoint,
    tag,
    fetch: fetchJSONFile,
  });
}

export function getPreset({
  repo,
  presetName = 'default',
  presetPath,
  tag = undefined,
}: PresetConfig): Promise<Nullish<Preset>> {
  return getPresetFromEndpoint(repo, presetName, presetPath, Endpoint, tag);
}
