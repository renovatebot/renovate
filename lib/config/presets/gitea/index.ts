import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import type { Nullish } from '../../../types/index.ts';
import type { RepoContents } from '../../../util/gitea/contents.ts';
import { API_BASE_PATH, getRepoFile } from '../../../util/gitea/contents.ts';
import { GiteaHttp } from '../../../util/http/gitea.ts';
import type { Preset, PresetConfig } from '../types.ts';
import {
  PRESET_DEP_NOT_FOUND,
  PRESET_INVALID,
  fetchPreset,
  parsePreset,
} from '../util.ts';

export const Endpoint = 'https://gitea.com/';

const http = new GiteaHttp();

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string,
  tag?: string | null,
): Promise<Nullish<Preset>> {
  let res: RepoContents;
  try {
    res = await getRepoFile(http, API_BASE_PATH, repo, fileName, tag, {
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

  if (res.type !== 'file') {
    logger.debug(
      `Preset ${fileName} has unexpected type '${res.type}'. Only \`file\` is supported`,
    );
    throw new Error(PRESET_INVALID);
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
  tag,
}: PresetConfig): Promise<Nullish<Preset>> {
  return getPresetFromEndpoint(repo, presetName, presetPath, Endpoint, tag);
}
