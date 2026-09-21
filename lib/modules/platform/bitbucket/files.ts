import type {
  BitbucketHttp,
  BitbucketHttpOptions,
} from '../../../util/http/bitbucket.ts';
import { joinUrlParts } from '../../../util/url.ts';

/**
 * Read a single file from a repository at a given ref, defaulting to `HEAD`.
 *
 * The URL is relative to the API root, which comes from `options.baseUrl`, or
 * from the `Http` instance's own base URL when the caller reads the host it is
 * configured for.
 *
 * https://developer.atlassian.com/cloud/bitbucket/rest/api-group-source/#api-repositories-workspace-repo-slug-src-commit-path-get
 */
export async function getRepoFile(
  http: BitbucketHttp,
  repo: string,
  filePath: string,
  ref?: string | null,
  options: BitbucketHttpOptions = {},
): Promise<string> {
  const url = joinUrlParts(
    '2.0/repositories',
    repo,
    'src',
    ref ?? 'HEAD',
    filePath,
  );
  const res = await http.getText(url, options);
  return res.body;
}
