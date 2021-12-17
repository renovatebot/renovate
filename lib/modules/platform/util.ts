import {
  GITHUB_API_USING_HOST_TYPES,
  GITLAB_API_USING_HOST_TYPES,
} from '../../constants';
import * as hostRules from '../../util/host-rules';
import { parseUrl } from '../../util/url';
import hasha from 'hasha';

/**
 * Tries to detect the `platform from a url.
 *
 * @param url the url to detect platform from
 * @returns matched `platform` if found, otherwise `null`
 */
export function detectPlatform(
  url: string
): 'gitlab' | 'github' | 'azure' | null {
  const { hostname } = parseUrl(url) ?? {};
  if (hostname === 'github.com' || hostname?.includes('github')) {
    return 'github';
  }
  if (hostname === 'gitlab.com' || hostname?.includes('gitlab')) {
    return 'gitlab';
  }

  if (hostname === 'dev.azure.com' || hostname?.includes('visualstudio.com')) {
    return 'azure';
  }

  const hostType = hostRules.hostType({ url: url });

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

export function repoFingerprint(
  repoId: number | string,
  endpoint: string | undefined
): string {
  const input = endpoint ? `${endpoint}::${repoId}` : `${repoId}`;
  const fingerprint = hasha(input);
  return fingerprint;
}

export function getNewBranchName(branchName?: string): string | undefined {
  if (branchName && !branchName.startsWith('refs/heads/')) {
    return `refs/heads/${branchName}`;
  }
  return branchName;
}
