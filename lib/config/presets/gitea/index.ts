import { getRepoContents } from '../../../modules/platform/gitea/gitea-helper.ts';
import type { Nullish } from '../../../types/index.ts';
import type { Preset, PresetConfig } from '../types.ts';
import * as common from './common.ts';

export const Endpoint = 'https://gitea.com/';

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
