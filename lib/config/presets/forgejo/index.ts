import { getRepoContents } from '../../../modules/platform/forgejo/forgejo-helper.ts';
import type { Nullish } from '../../../types/index.ts';
import * as common from '../gitea/common.ts';
import type { Preset, PresetConfig } from '../types.ts';

export const Endpoint = 'https://code.forgejo.org/';

export function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string,
  tag?: string | null,
): Promise<Nullish<Preset>> {
  return common.fetchJSONFile(getRepoContents, repo, fileName, endpoint, tag);
}

export function getPresetFromEndpoint(
  repo: string,
  filePreset: string,
  presetPath?: string,
  endpoint = Endpoint,
  tag?: string,
): Promise<Nullish<Preset>> {
  return common.getPresetFromEndpoint(
    getRepoContents,
    repo,
    filePreset,
    presetPath,
    endpoint,
    tag,
  );
}

export function getPreset({
  repo,
  presetName = 'default',
  presetPath,
  tag,
}: PresetConfig): Promise<Nullish<Preset>> {
  return getPresetFromEndpoint(repo, presetName, presetPath, Endpoint, tag);
}
