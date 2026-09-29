import { HOST_BLOCKED } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider.ts';
import { Http } from '../../../util/http/index.ts';
import type { HttpResponse } from '../../../util/http/types.ts';
import { parseUrl } from '../../../util/url.ts';
import type { Preset, PresetConfig } from '../types.ts';
import { PRESET_DEP_NOT_FOUND, parsePreset } from '../util.ts';

// every response this instance fetches becomes Renovate configuration, so an internal host needs a deliberately-scoped `allowInternal` grant
const http = new Http('preset', { responseBecomesConfig: true });

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

    // keep the block distinguishable from a plain 404, so it surfaces as its own config validation error
    if (err.message === HOST_BLOCKED) {
      throw err;
    }

    logger.debug(`Preset file ${url} not found: ${err.message}`);
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  return parsePreset(response.body, parsedUrl.pathname);
}
