import { z } from 'zod/v4';
import type { GiteaHttp, GiteaHttpOptions } from '../http/gitea.ts';
import { fromBase64 } from '../string.ts';
import { getQueryString } from '../url.ts';

/**
 * The Gitea "repository contents" API, shared by Gitea and Forgejo.
 *
 * https://docs.gitea.com/api/1.20/#tag/repository/operation/repoGetContents
 */

const ContentsCommon = z.object({
  name: z.string(),
  path: z.string(),
});

const ContentsFile = ContentsCommon.extend({
  type: z.literal('file'),
  content: z.string().nullable(),
}).transform((input) => ({
  ...input,
  contentString: input.content ? fromBase64(input.content) : '',
}));

const ContentsDir = ContentsCommon.extend({ type: z.literal('dir') });
const ContentsSymlink = ContentsCommon.extend({ type: z.literal('symlink') });
const ContentsSubmodule = ContentsCommon.extend({
  type: z.literal('submodule'),
});

export const RepoContents = z.discriminatedUnion('type', [
  ContentsFile,
  ContentsDir,
  ContentsSymlink,
  ContentsSubmodule,
]);
export type RepoContents = z.infer<typeof RepoContents>;

export const ContentsListResponse = z.array(RepoContents);

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
