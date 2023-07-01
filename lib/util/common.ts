import {
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
): 'gitlab' | 'github' | 'azure' | 'bitbucket' | null {
  const { hostname } = parseUrl(url) ?? {};
  if (hostname === 'github.com' || hostname?.includes('github')) {
    return 'github';
  }
  if (hostname === 'gitlab.com' || hostname?.includes('gitlab')) {
    return 'gitlab';
  }
  if (hostname === 'dev.azure.com' || hostname?.endsWith('.visualstudio.com')) {
    return 'azure';
  }
  if (hostname === 'bitbucket.org' || hostname?.includes('bitbucket')) {
    return 'bitbucket';
  }

  const hostType = hostRules.hostType({ url });

  if (!hostType) {
    return null;
  }

  if (GITLAB_API_USING_HOST_TYPES.includes(hostType)) {
    return 'gitlab';
  }
  if (GITHUB_API_USING_HOST_TYPES.includes(hostType)) {
    return 'github';
  }

  return null;
}
