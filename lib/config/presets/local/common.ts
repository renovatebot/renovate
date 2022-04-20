import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { Preset } from '../types';
import { PRESET_DEP_NOT_FOUND, fetchPreset, parsePreset } from '../util';

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  _endpoint: string = null
): Promise<Preset> {
  let raw: string | undefined;
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

  return parsePreset(raw);
}

export function getPresetFromEndpoint(
  repo: string,
  filePreset: string,
  presetPath: string,
  endpoint: string
): Promise<Preset> {
  return fetchPreset({
    repo,
    filePreset,
    presetPath,
    endpoint,
    fetch: fetchJSONFile,
  });
}
