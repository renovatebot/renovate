import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { FileData } from '../../../types/platform/bitbucket-server';
import {
  BitbucketServerHttp,
  setBaseUrl,
} from '../../../util/http/bitbucket-server';
import type { Preset } from '../types';
import {
  PRESET_DEP_NOT_FOUND,
  PRESET_INVALID_JSON,
  fetchPreset,
} from '../util';

const http = new BitbucketServerHttp();

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string,
  branchOrTag?: string
): Promise<Preset> {
  const [projectKey, repositorySlug] = repo.split('/');
  setBaseUrl(endpoint);
  let url = `rest/api/1.0/projects/${projectKey}/repos/${repositorySlug}/browse/${fileName}?limit=20000`;
  if (branchOrTag) {
    url += '&at=' + encodeURIComponent(branchOrTag);
  }

  let res: { body: FileData };
  try {
    res = await http.getJson(url);
  } catch (err) {
    // istanbul ignore if: not testable with nock
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.debug(
      { statusCode: err.statusCode, url: `${endpoint}${url}` },
      `Failed to retrieve ${fileName} from repo`
    );
    throw new Error(PRESET_DEP_NOT_FOUND);
  }
  if (!res.body.isLastPage) {
    logger.warn({ size: res.body.size }, 'Renovate config to big');
    throw new Error(PRESET_INVALID_JSON);
  }
  try {
    const content = res.body.lines.map((l) => l.text).join('');
    const parsed = JSON.parse(content);
    return parsed;
  } catch (err) {
    throw new Error(PRESET_INVALID_JSON);
  }
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
