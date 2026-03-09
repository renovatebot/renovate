import { logger } from '../../../logger/index.ts';
import { platform } from '../../../modules/platform/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import type { Nullish } from '../../../types/index.ts';
import type { Preset } from '../types.ts';
import { PRESET_DEP_NOT_FOUND, fetchPreset, parsePreset } from '../util.ts';

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  _endpoint?: string,
  tag?: string,
): Promise<Nullish<Preset>> {
  let raw: string | null;
  try {
    raw = await platform.getRawFile(fileName, repo, tag ?? undefined);
  } catch (err) {
    if (err instanceof ExternalHostError) {
      throw err;
    }

    logger.debug(
      `Preset file ${fileName} not found in ${repo}: ${err.message}}`,
    );

    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  if (!raw) {
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  return parsePreset(raw, fileName);
}

export function getPresetFromEndpoint(
  repo: string,
  filePreset: string,
  presetPath: string | undefined,
  endpoint: string,
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
