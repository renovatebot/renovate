import { logger } from '../../../logger';
import { getRepoContents } from '../../../modules/platform/gitea/gitea-helper';
import type { RepoContents } from '../../../modules/platform/gitea/types';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { fromBase64 } from '../../../util/string';
import type { Preset, PresetConfig } from '../types';
import { PRESET_DEP_NOT_FOUND, fetchPreset, parsePreset } from '../util';

export const Endpoint = 'https://gitea.com/';

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string,
  tag?: string | null,
): Promise<Preset> {
  let res: RepoContents;
  try {
    res = await getRepoContents(repo, fileName, tag, {
      baseUrl: endpoint,
    });
  } catch (err) {
    // istanbul ignore if: not testable with nock
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.debug(`Preset file ${fileName} not found in ${repo}`);
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  // TODO: null check #22198
  return parsePreset(fromBase64(res.content!), fileName);
}

export function getPresetFromEndpoint(
  repo: string,
  filePreset: string,
  presetPath?: string,
  endpoint = Endpoint,
  tag?: string | undefined,
): Promise<Preset | undefined> {
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
}: PresetConfig): Promise<Preset | undefined> {
  return getPresetFromEndpoint(repo, presetName, presetPath, Endpoint, tag);
}
