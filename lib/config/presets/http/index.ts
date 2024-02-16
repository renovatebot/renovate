import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { Http } from '../../../util/http';
import { parseUrl } from '../../../util/url';
import type { Preset, PresetConfig } from '../types';
import { PRESET_DEP_NOT_FOUND, extractSubPreset, parsePreset } from '../util';

const id = 'http';

const http = new Http(id);

export async function getPreset({
  repo: url,
  presetName,
}: PresetConfig): Promise<Preset | null | undefined> {
  const parsedUrl = parseUrl(url);
  let response;

  if (!parsedUrl) {
    logger.debug(`Preset URL ${url} is malformed`);
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  try {
    response = await http.get(url);
  } catch (err) {
    // istanbul ignore if: not testable with nock
    if (err instanceof ExternalHostError) {
      throw err;
    }

    logger.debug(`Preset file ${url} not found`);
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  const parsed = parsePreset(response.body, parsedUrl.pathname);

  return extractSubPreset(parsed, presetName);
}
