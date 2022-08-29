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
  parsePreset,
} from '../util';

const http = new BitbucketServerHttp();

export async function fetchJSONFile(
  repo: string,
  fileName: string,
  endpoint: string,
  branchOrTag?: string | null
): Promise<Preset | null> {
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
    logger.warn({ size: res.body.size }, 'Renovate config too big');
    throw new Error(PRESET_INVALID_JSON);
  }
  return parsePreset(res.body.lines.map((l) => l.text).join(''));
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
