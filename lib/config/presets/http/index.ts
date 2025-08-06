import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { Http } from '../../../util/http';
import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider';
import type { HttpResponse } from '../../../util/http/types';
import { parseUrl } from '../../../util/url';
import type { Preset, PresetConfig } from '../types';
import { PRESET_DEP_NOT_FOUND, parsePreset } from '../util';

const http = new Http('preset');

export async function getPreset({
  repo: url,
}: PresetConfig): Promise<Preset | null | undefined> {
  const parsedUrl = parseUrl(url);
  let response: HttpResponse;

  if (!parsedUrl) {
    logger.debug(`Preset URL ${url} is malformed`);
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  try {
    response = await http.getText(url, { cacheProvider: memCacheProvider });
  } catch (err) {
    if (err instanceof ExternalHostError) {
      throw err;
    }

    logger.debug(`Preset file ${url} not found: ${err.message}`);
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  return parsePreset(response.body, parsedUrl.pathname);
}
