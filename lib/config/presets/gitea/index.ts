import { logger } from '../../../logger';
import {
  RepoContents,
  getRepoContents,
} from '../../../modules/platform/gitea/gitea-helper';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { fromBase64 } from '../../../util/string';
import type { Preset, PresetConfig } from '../types';
import { PRESET_DEP_NOT_FOUND, fetchPreset, parsePreset } from '../util';

export const Endpoint = 'https://gitea.com/api/v1/';

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string,
  tag?: string
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
    logger.debug(
      { statusCode: err.statusCode, repo, fileName },
      `Failed to retrieve ${fileName} from repo`
    );
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  return parsePreset(fromBase64(res.content));
}

export function getPresetFromEndpoint(
  repo: string,
  filePreset: string,
  presetPath: string,
  endpoint = Endpoint,
  tag?: string
): Promise<Preset> {
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
  tag = null,
}: PresetConfig): Promise<Preset> {
  return getPresetFromEndpoint(repo, presetName, presetPath, Endpoint, tag);
}
