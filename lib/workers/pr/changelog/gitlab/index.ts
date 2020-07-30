import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../logger';
import { GitlabTreeNode } from '../../../../types/platform/gitlab';
import { GitlabHttp } from '../../../../util/http/gitlab';
import { ensureTrailingSlash } from '../../../../util/url';
import { ChangeLogFile, ChangeLogNotes } from '../common';

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
  )}/repository/tags`;
  try {
    const res = await http.getJson<{ name: string }[]>(url);

    const tags = res.body;

    if (!tags.length) {
      logger.debug({ sourceRepo: repository }, 'repository has no Gitlab tags');
    }

    return tags.map((tag) => tag.name).filter(Boolean);
  } catch (err) {
    logger.info({ sourceRepo: repository }, 'Failed to fetch Gitlab tags');
    // istanbul ignore if
    if (err.message && err.message.includes('Bad credentials')) {
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
  const apiPrefix = `${ensureTrailingSlash(
    apiBaseUrl
  )}projects/${repository}/repository/`;

  // https://docs.gitlab.com/13.2/ee/api/repositories.html#list-repository-tree
  let files = (await http.getJson<GitlabTreeNode[]>(`${apiPrefix}tree/`)).body;

  files = files.filter((f) => changelogFilenameRegex.test(f.name));
  if (!files.length) {
    logger.trace('no changelog file found');
    return null;
  }
  const { name: changelogFile } = files.shift();
  /* istanbul ignore if */
  if (files.length > 1) {
    logger.debug(
      `Multiple candidates for changelog file, using ${changelogFile}`
    );
  }

  const fileRes = await http.getJson<{ content: string }>(
    `${apiPrefix}files/${changelogFile}?ref=master`
  );
  const changelogMd =
    Buffer.from(fileRes.body.content, 'base64').toString() + '\n#\n##';
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
