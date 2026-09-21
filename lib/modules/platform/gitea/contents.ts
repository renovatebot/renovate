import type { GiteaHttp, GiteaHttpOptions } from '../../../util/http/gitea.ts';
import { getQueryString } from '../../../util/url.ts';
import { ContentsListResponse, RepoContents } from './schema.ts';

/**
 * The Gitea "repository contents" API, shared by Gitea and Forgejo.
 *
 * https://docs.gitea.com/api/1.20/#tag/repository/operation/repoGetContents
 */

/**
 * Default API base path, relative to the `Http` instance's base URL or to an
 * explicitly passed `baseUrl` option.
 */
export const API_BASE_PATH = '/api/v1/';

/**
 * Escape each path segment on its own, so that the slashes separating them
 * stay slashes in the URL.
 */
function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function contentsUrl(
  apiBaseUrl: string,
  repoPath: string,
  path?: string,
): string {
  const suffix = path ? `/${encodePath(path)}` : '';
  return `${apiBaseUrl}repos/${repoPath}/contents${suffix}`;
}

/**
 * Read a single file from a repository, optionally at a given ref.
 */
export async function getRepoFile(
  http: GiteaHttp,
  apiBaseUrl: string,
  repoPath: string,
  filePath: string,
  ref?: string | null,
  options: GiteaHttpOptions = {},
): Promise<RepoContents> {
  const query = getQueryString(ref ? { ref } : {});
  const url = `${contentsUrl(apiBaseUrl, repoPath, filePath)}?${query}`;
  const res = await http.getJson(url, options, RepoContents);
  return res.body;
}

/**
 * List the entries of a repository directory, defaulting to the repository root.
 */
export async function listRepoDir(
  http: GiteaHttp,
  apiBaseUrl: string,
  repoPath: string,
  dirPath?: string,
  options: GiteaHttpOptions = {},
): Promise<RepoContents[]> {
  const url = contentsUrl(apiBaseUrl, repoPath, dirPath);
  const res = await http.getJson(url, options, ContentsListResponse);
  return res.body;
}
