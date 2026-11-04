import type {
  GitlabHttp,
  GitlabHttpOptions,
} from '../../../util/http/gitlab.ts';
import { fromBase64 } from '../../../util/string.ts';

/**
 * Read a single file from a project at a given ref, defaulting to `HEAD`.
 *
 * The URL is relative to the API root, which comes from `options.baseUrl`, or
 * from the `Http` instance's own base URL when the caller reads the host it is
 * configured for.
 *
 * `project` is the URL-encoded project path or the numeric project ID, as
 * GitLab expects it in the URL.
 *
 * https://docs.gitlab.com/api/repository_files/#get-file-from-repository
 */
export async function getRepoFile(
  http: GitlabHttp,
  project: string,
  fileName: string,
  ref?: string | null,
  options: GitlabHttpOptions = {},
): Promise<string> {
  const encodedFileName = encodeURIComponent(fileName);
  const url = `projects/${project}/repository/files/${encodedFileName}?ref=${ref ?? 'HEAD'}`;
  const res = await http.getJsonUnchecked<{ content: string }>(url, options);
  return fromBase64(res.body.content);
}
