import type {
  GithubHttp,
  GithubHttpOptions,
} from '../../../util/http/github.ts';
import { fromBase64 } from '../../../util/string.ts';

/**
 * Read a single file from a repository, optionally at a given ref.
 *
 * The URL is relative to the API root, which comes from `options.baseUrl`, or
 * from the `Http` instance's own base URL when the caller reads the host it is
 * configured for.
 *
 * https://docs.github.com/en/rest/repos/contents
 */
export async function getRepoFile(
  http: GithubHttp,
  repo: string,
  fileName: string,
  ref?: string | null,
  options: GithubHttpOptions = {},
): Promise<string> {
  let url = `repos/${repo}/contents/${fileName}`;
  if (ref) {
    url += `?ref=${ref}`;
  }
  const res = await http.getJsonUnchecked<{ content: string }>(url, options);
  return fromBase64(res.body.content);
}
