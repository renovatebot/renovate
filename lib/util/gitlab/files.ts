import type { GitlabHttp, GitlabHttpOptions } from '../http/gitlab.ts';
import { fromBase64 } from '../string.ts';

/**
 * Read a single file from a project at a given ref, defaulting to `HEAD`.
 *
 * `apiBaseUrl` must end with a slash, or be empty to use the `Http`
 * instance's own base URL. `project` is the URL-encoded project path or the
 * numeric project ID, as GitLab expects it in the URL.
 *
 * https://docs.gitlab.com/api/repository_files/#get-file-from-repository
 */
export async function getRepoFile(
  http: GitlabHttp,
  apiBaseUrl: string,
  project: string,
  fileName: string,
  ref?: string | null,
  options: GitlabHttpOptions = {},
): Promise<string> {
  const encodedFileName = encodeURIComponent(fileName);
  const url = `${apiBaseUrl}projects/${project}/repository/files/${encodedFileName}?ref=${ref ?? 'HEAD'}`;
  const res = await http.getJsonUnchecked<{ content: string }>(url, options);
  return fromBase64(res.body.content);
}
