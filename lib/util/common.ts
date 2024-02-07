import JSON5 from 'json5';
import {
  BITBUCKET_API_USING_HOST_TYPES,
  GITEA_API_USING_HOST_TYPES,
  GITHUB_API_USING_HOST_TYPES,
  GITLAB_API_USING_HOST_TYPES,
} from '../constants';
import { logger } from '../logger';
import * as hostRules from './host-rules';
import { parseUrl } from './url';

/**
 * Tries to detect the `platform` from a url.
 *
 * @param url the url to detect `platform` from
 * @returns matched `platform` if found, otherwise `null`
 */
export function detectPlatform(
  url: string,
): 'azure' | 'bitbucket' | 'gitea' | 'github' | 'gitlab' | null {
  const { hostname } = parseUrl(url) ?? {};
  if (hostname === 'dev.azure.com' || hostname?.endsWith('.visualstudio.com')) {
    return 'azure';
  }
  if (hostname === 'bitbucket.org' || hostname?.includes('bitbucket')) {
    return 'bitbucket';
  }
  if (
    hostname &&
    (['gitea.com', 'codeberg.org'].includes(hostname) ||
      hostname.includes('gitea') ||
      hostname.includes('forgejo'))
  ) {
    return 'gitea';
  }
  if (hostname === 'github.com' || hostname?.includes('github')) {
    return 'github';
  }
  if (hostname === 'gitlab.com' || hostname?.includes('gitlab')) {
    return 'gitlab';
  }

  const hostType = hostRules.hostType({ url });

  if (!hostType) {
    return null;
  }

  if (BITBUCKET_API_USING_HOST_TYPES.includes(hostType)) {
    return 'bitbucket';
  }
  if (GITEA_API_USING_HOST_TYPES.includes(hostType)) {
    return 'gitea';
  }
  if (GITHUB_API_USING_HOST_TYPES.includes(hostType)) {
    return 'github';
  }
  if (GITLAB_API_USING_HOST_TYPES.includes(hostType)) {
    return 'gitlab';
  }

  return null;
}

export function noLeadingAtSymbol(input: string): string {
  return input.startsWith('@') ? input.slice(1) : input;
}

export function parseJson(content: string | null, filename: string): unknown {
  if (!content) {
    return null;
  }

  return filename.endsWith('.json5')
    ? JSON5.parse(content)
    : parseJsonWithFallback(content, filename);
}

export function parseJsonWithFallback(
  content: string,
  context: string,
): unknown {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(content);
  } catch (err) {
    parsedJson = JSON5.parse(content);
    logger.warn(
      { context },
      'File contents are invalid JSON but parse using JSON5. Support for this will be removed in a future release so please change to a support .json5 file name or ensure correct JSON syntax.',
    );
  }

  return parsedJson;
}
