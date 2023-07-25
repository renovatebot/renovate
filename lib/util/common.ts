import {
  BITBUCKET_API_USING_HOST_TYPES,
  GITHUB_API_USING_HOST_TYPES,
  GITLAB_API_USING_HOST_TYPES,
} from '../constants';
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
): 'azure' | 'bitbucket' | 'github' | 'gitlab' | null {
  const { hostname } = parseUrl(url) ?? {};
  if (hostname === 'dev.azure.com' || hostname?.endsWith('.visualstudio.com')) {
    return 'azure';
  }
  if (hostname === 'bitbucket.org' || hostname?.includes('bitbucket')) {
    return 'bitbucket';
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
  if (GITHUB_API_USING_HOST_TYPES.includes(hostType)) {
    return 'github';
  }
  if (GITLAB_API_USING_HOST_TYPES.includes(hostType)) {
    return 'gitlab';
  }

  return null;
}
