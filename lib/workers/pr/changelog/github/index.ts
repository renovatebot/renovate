import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../logger';
import type {
  GithubGitBlob,
  GithubGitTree,
} from '../../../../types/platform/github';
import { GithubHttp } from '../../../../util/http/github';
import { ensureTrailingSlash } from '../../../../util/url';
import type { ChangeLogFile, ChangeLogNotes } from '../types';

const http = new GithubHttp();

export async function getTags(
  endpoint: string,
  repository: string
): Promise<string[]> {
  logger.trace('github.getTags()');
  const url = `${endpoint}repos/${repository}/tags?per_page=100`;
  try {
    const res = await http.getJson<{ name: string }[]>(url, {
      paginate: true,
    });

    const tags = res.body;

    if (!tags.length) {
      logger.debug({ repository }, 'repository has no Github tags');
    }

    return tags.map((tag) => tag.name).filter(Boolean);
  } catch (err) {
    logger.debug({ sourceRepo: repository }, 'Failed to fetch Github tags');
    logger.debug({ err });
    // istanbul ignore if
    if (err.message?.includes('Bad credentials')) {
      logger.warn('Bad credentials triggering tag fail lookup in changelog');
      throw err;
    }
    return [];
  }
}

export async function getReleaseNotesMd(
  repository: string,
  apiBaseUrl: string
): Promise<ChangeLogFile> | null {
  logger.trace('github.getReleaseNotesMd()');
  const apiPrefix = `${ensureTrailingSlash(apiBaseUrl)}repos/${repository}`;
  const { default_branch: defaultBranch = 'master' } = (
    await http.getJson<{ default_branch: string }>(apiPrefix)
  ).body;

  // https://docs.github.com/en/rest/reference/git#get-a-tree
  const res = await http.getJson<GithubGitTree>(
    `${apiPrefix}/git/trees/${defaultBranch}`
  );

  // istanbul ignore if
  if (res.body.truncated) {
    logger.debug({ repository }, 'Git tree truncated');
  }

  const files = res.body.tree
    .filter((f) => f.type === 'blob')
    .filter((f) => changelogFilenameRegex.test(f.path));

  if (!files.length) {
    logger.trace('no changelog file found');
    return null;
  }
  const { path: changelogFile, sha } = files.shift();
  /* istanbul ignore if */
  if (files.length !== 0) {
    logger.debug(
      `Multiple candidates for changelog file, using ${changelogFile}`
    );
  }

  // https://docs.github.com/en/rest/reference/git#get-a-blob
  const fileRes = await http.getJson<GithubGitBlob>(
    `${apiPrefix}/git/blobs/${sha}`
  );

  const changelogMd =
    Buffer.from(fileRes.body.content, 'base64').toString() + '\n#\n##';
  return { changelogFile, changelogMd };
}

export async function getReleaseList(
  apiBaseUrl: string,
  repository: string
): Promise<ChangeLogNotes[]> {
  logger.trace('github.getReleaseList()');
  const url = `${ensureTrailingSlash(
    apiBaseUrl
  )}repos/${repository}/releases?per_page=100`;
  const res = await http.getJson<
    {
      html_url: string;
      id: number;
      tag_name: string;
      name: string;
      body: string;
    }[]
  >(url, { paginate: true });
  return res.body.map((release) => ({
    url: release.html_url,
    id: release.id,
    tag: release.tag_name,
    name: release.name,
    body: release.body,
  }));
}
