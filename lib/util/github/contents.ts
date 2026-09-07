import type { GithubHttp, GithubHttpOptions } from '../http/github.ts';
import { fromBase64 } from '../string.ts';

/**
 * Read a single file from a repository, optionally at a given ref.
 *
 * `apiBaseUrl` must end with a slash, or be empty to use the `Http`
 * instance's own base URL.
 *
 * https://docs.github.com/en/rest/repos/contents
 */
export async function getRepoFile(
  http: GithubHttp,
  apiBaseUrl: string,
  repo: string,
  fileName: string,
  ref?: string | null,
  options: GithubHttpOptions = {},
): Promise<string> {
  let url = `${apiBaseUrl}repos/${repo}/contents/${fileName}`;
  if (ref) {
    url += `?ref=${ref}`;
  }
  const res = await http.getJsonUnchecked<{ content: string }>(url, options);
  return fromBase64(res.body.content);
}
