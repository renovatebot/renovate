import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { Nullish } from '../../../types';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { repoCacheProvider } from '../../../util/http/cache/repository-http-cache-provider';
import { GithubHttp } from '../../../util/http/github';
import { fromBase64 } from '../../../util/string';
import type { Preset, PresetConfig } from '../types';
import { PRESET_DEP_NOT_FOUND, fetchPreset, parsePreset } from '../util';

export const Endpoint = 'https://api.github.com/';

const http = new GithubHttp();

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string,
  tag?: string,
): Promise<Nullish<Preset>> {
  let ref = '';
  if (is.nonEmptyString(tag)) {
    ref = `?ref=${tag}`;
  }
  const url = `${endpoint}repos/${repo}/contents/${fileName}${ref}`;
  logger.trace({ url }, `Preset URL`);
  let res: { body: { content: string } };
  try {
    res = await http.getJsonUnchecked(url, {
      cacheProvider: repoCacheProvider,
    });
  } catch (err) {
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.debug(
      `Preset file ${fileName} not found in ${repo}: ${err.message}`,
    );
    throw new Error(PRESET_DEP_NOT_FOUND);
  }

  return parsePreset(fromBase64(res.body.content), fileName);
}

export function getPresetFromEndpoint(
  repo: string,
  filePreset: string,
  presetPath?: string,
  endpoint = Endpoint,
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

export function getPreset({
  repo,
  presetName = 'default',
  presetPath,
  tag,
}: PresetConfig): Promise<Nullish<Preset>> {
  return getPresetFromEndpoint(repo, presetName, presetPath, Endpoint, tag);
}
