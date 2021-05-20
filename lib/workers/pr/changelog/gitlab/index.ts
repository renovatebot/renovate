import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../logger';
import type { GitlabTreeNode } from '../../../../types/platform/gitlab';
import { GitlabHttp } from '../../../../util/http/gitlab';
import { ensureTrailingSlash } from '../../../../util/url';
import type { ChangeLogFile, ChangeLogNotes } from '../types';

const http = new GitlabHttp();

function getRepoId(repository: string): string {
  return repository.replace(/\//g, '%2f');
}

export async function getTags(
  endpoint: string,
  repository: string
): Promise<string[]> {
  logger.trace('gitlab.getTags()');
  const url = `${ensureTrailingSlash(endpoint)}projects/${getRepoId(
    repository
  )}/repository/tags?per_page=100`;
  try {
    const res = await http.getJson<{ name: string }[]>(url, {
      paginate: true,
    });

    const tags = res.body;

    if (!tags.length) {
      logger.debug({ sourceRepo: repository }, 'repository has no Gitlab tags');
    }

    return tags.map((tag) => tag.name).filter(Boolean);
  } catch (err) {
    logger.info({ sourceRepo: repository }, 'Failed to fetch Gitlab tags');
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
  logger.trace('gitlab.getReleaseNotesMd()');
  const repoid = getRepoId(repository);
  const apiPrefix = `${ensureTrailingSlash(
    apiBaseUrl
  )}projects/${repoid}/repository/`;

  // https://docs.gitlab.com/13.2/ee/api/repositories.html#list-repository-tree
  let files = (
    await http.getJson<GitlabTreeNode[]>(`${apiPrefix}tree?per_page=100`, {
      paginate: true,
    })
  ).body;

  files = files
    .filter((f) => f.type === 'blob')
    .filter((f) => changelogFilenameRegex.test(f.path));
  if (!files.length) {
    logger.trace('no changelog file found');
    return null;
  }
  const { path: changelogFile, id } = files.shift();
  /* istanbul ignore if */
  if (files.length !== 0) {
    logger.debug(
      `Multiple candidates for changelog file, using ${changelogFile}`
    );
  }

  // https://docs.gitlab.com/13.2/ee/api/repositories.html#raw-blob-content
  const fileRes = await http.get(`${apiPrefix}blobs/${id}/raw`);
  const changelogMd = fileRes.body + '\n#\n##';
  return { changelogFile, changelogMd };
}

export async function getReleaseList(
  apiBaseUrl: string,
  repository: string
): Promise<ChangeLogNotes[]> {
  logger.trace('gitlab.getReleaseNotesMd()');

  const repoId = getRepoId(repository);
  const apiUrl = `${ensureTrailingSlash(
    apiBaseUrl
  )}projects/${repoId}/releases`;
  const res = await http.getJson<
    {
      name: string;
      release: string;
      description: string;
      tag_name: string;
    }[]
  >(`${apiUrl}?per_page=100`, {
    paginate: true,
  });
  return res.body.map((release) => ({
    url: `${apiUrl}/${release.tag_name}`,
    name: release.name,
    body: release.description,
    tag: release.tag_name,
  }));
}
