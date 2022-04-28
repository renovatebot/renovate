import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
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
  _endpoint?: string
): Promise<Preset> {
  let raw: string | null;
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
    // TODO: null check #7154
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return JSON.parse(raw!);
  } catch (err) {
    throw new Error(PRESET_INVALID_JSON);
  }
}

export function getPresetFromEndpoint(
  repo: string,
  filePreset: string,
  presetPath: string | undefined,
  endpoint: string,
  tag?: string | null
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
