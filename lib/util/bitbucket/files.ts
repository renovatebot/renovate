import type { BitbucketHttp, BitbucketHttpOptions } from '../http/bitbucket.ts';
import { joinUrlParts } from '../url.ts';

/**
 * Read a single file from a repository at a given ref, defaulting to `HEAD`.
 *
 * `apiBaseUrl` may be `/` to use the `Http` instance's own base URL.
 *
 * https://developer.atlassian.com/cloud/bitbucket/rest/api-group-source/#api-repositories-workspace-repo-slug-src-commit-path-get
 */
export async function getRepoFile(
  http: BitbucketHttp,
  apiBaseUrl: string,
  repo: string,
  filePath: string,
  ref?: string | null,
  options: BitbucketHttpOptions = {},
): Promise<string> {
  const url = joinUrlParts(
    apiBaseUrl,
    '2.0/repositories',
    repo,
    'src',
    ref ?? 'HEAD',
    filePath,
  );
  const res = await http.getText(url, options);
  return res.body;
}
