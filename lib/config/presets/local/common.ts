import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { Preset } from '../types';
import {
  PRESET_DEP_NOT_FOUND,
  PRESET_INVALID_JSON,
  fetchPreset,
} from '../util';

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  _endpoint: string = null
): Promise<Preset> {
  let raw: string;
  try {
    raw = await platform.getRawFile(fileName, repo);
  } catch (err) {
    // istanbul ignore if: not testable with nock
    if (err instanceof ExternalHostError) {
      throw err;
    }

    logger.debug(
      { err, repo, fileName },
      `Failed to retrieve ${fileName} from repo ${repo}`
    );

    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(PRESET_INVALID_JSON);
  }
}

export function getPresetFromEndpoint(
  pkgName: string,
  filePreset: string,
  presetPath: string,
  endpoint: string
): Promise<Preset> {
  return fetchPreset({
    pkgName,
    filePreset,
    presetPath,
    endpoint,
    fetch: fetchJSONFile,
  });
}
