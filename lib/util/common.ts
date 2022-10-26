import {
  AZURE_API_USING_HOST_TYPES,
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
export function detectPlatform(url: string): 'gitlab' | 'github' | 'azure' | null {
  const { hostname } = parseUrl(url) ?? {};
  if (hostname === 'github.com' || hostname?.includes('github')) {
    return 'github';
  }
  if (hostname === 'gitlab.com' || hostname?.includes('gitlab')) {
    return 'gitlab';
  }
  if (hostname === 'dev.azure.com' || hostname?.includes('azure')) {
    return 'azure';
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
  if (AZURE_API_USING_HOST_TYPES.includes(hostType)) {
    return 'azure';
  }

  return null;
}
