import { logger } from '../../../logger';
import {
  RepoContents,
  getRepoContents,
} from '../../../platform/gitea/gitea-helper';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { fromBase64 } from '../../../util/string';
import type { Preset, PresetConfig } from '../types';
import {
  PRESET_DEP_NOT_FOUND,
  PRESET_INVALID_JSON,
  fetchPreset,
} from '../util';

export const Endpoint = 'https://gitea.com/api/v1/';

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string,
  packageTag?: string
): Promise<Preset> {
  let res: RepoContents;
  try {
    res = await getRepoContents(repo, fileName, packageTag, {
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
  try {
    const content = fromBase64(res.content);
    const parsed = JSON.parse(content);
    return parsed;
  } catch (err) {
    throw new Error(PRESET_INVALID_JSON);
  }
}

export function getPresetFromEndpoint(
  pkgName: string,
  filePreset: string,
  presetPath: string,
  endpoint = Endpoint,
  packageTag?: string
): Promise<Preset> {
  return fetchPreset({
    pkgName,
    filePreset,
    presetPath,
    endpoint,
    packageTag,
    fetch: fetchJSONFile,
  });
}

export function getPreset({
  packageName: pkgName,
  presetName = 'default',
  presetPath,
  packageTag = null,
}: PresetConfig): Promise<Preset> {
  return getPresetFromEndpoint(
    pkgName,
    presetName,
    presetPath,
    Endpoint,
    packageTag
  );
}
