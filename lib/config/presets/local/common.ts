import { logger } from '../../../logger';
import { platform } from '../../../modules/platform';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { Preset } from '../types';
import { PRESET_DEP_NOT_FOUND, fetchPreset, parsePreset } from '../util';

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  _endpoint?: string,
  tag?: string | null
): Promise<Preset> {
  let raw: string | null;
  try {
    raw = await platform.getRawFile(fileName, repo, tag ?? undefined);
  } catch (err) {
    if (err instanceof ExternalHostError) {
      throw err;
    }

    logger.debug(`Preset file ${fileName} not found in ${repo}`);

    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  if (!raw) {
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  return parsePreset(raw);
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
