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
  url: string
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

export function parseJsonWithFallback(content: string): any {
  let parsedJson: any;

  try {
    parsedJson = JSON.parse(content);
  } catch (err) {
try {
    parsedJson = JSON5.parse(content);
    logger.warn(
      'JSON5.parse was used to parse the JSON data. Please check your json file'
    );
 } catch (err) {
      logger.warn('Invalid JSON format')
 }
  }

  return parsedJson;
}
