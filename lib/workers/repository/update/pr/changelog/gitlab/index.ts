import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger';
import type { GitlabRelease } from '../../../../../../modules/datasource/gitlab-releases/types';
import type { GitlabTag } from '../../../../../../modules/datasource/gitlab-tags/types';
import type { GitlabTreeNode } from '../../../../../../types/platform/gitlab';
import { GitlabHttp } from '../../../../../../util/http/gitlab';
import { ensureTrailingSlash } from '../../../../../../util/url';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types';

export const id = 'gitlab-changelog';
const http = new GitlabHttp(id);

export async function getTags(
  endpoint: string,
  repository: string
): Promise<string[]> {
  logger.trace('gitlab.getTags()');
  const urlEncodedRepo = encodeURIComponent(repository);
  const url = `${ensureTrailingSlash(
    endpoint
  )}projects/${urlEncodedRepo}/repository/tags?per_page=100`;
  try {
    const res = await http.getJson<GitlabTag[]>(url, {
      paginate: true,
    });

    const tags = res.body;

    if (!tags.length) {
      logger.debug(`No Gitlab tags found for ${repository}`);
    }

    return tags.map((tag) => tag.name).filter(Boolean);
  } catch (err) {
    logger.debug(
      { sourceRepo: repository, err },
      'Failed to fetch Gitlab tags'
    );
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
  apiBaseUrl: string,
  sourceDirectory?: string
): Promise<ChangeLogFile | null> {
  logger.trace('gitlab.getReleaseNotesMd()');
  const urlEncodedRepo = encodeURIComponent(repository);
  const apiPrefix = `${ensureTrailingSlash(
    apiBaseUrl
  )}projects/${urlEncodedRepo}/repository/`;

  // https://docs.gitlab.com/13.2/ee/api/repositories.html#list-repository-tree
  const tree = (
    await http.getJson<GitlabTreeNode[]>(
      `${apiPrefix}tree?per_page=100${
        sourceDirectory ? `&path=${sourceDirectory}` : ''
      }`,
      {
        paginate: true,
      }
    )
  ).body;
  const allFiles = tree.filter((f) => f.type === 'blob');
  let files: GitlabTreeNode[] = [];
  if (!files.length) {
    files = allFiles.filter((f) => changelogFilenameRegex.test(f.name));
  }
  if (!files.length) {
    logger.trace('no changelog file found');
    return null;
  }
  const { path: changelogFile, id } = files.shift()!;
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
  project: ChangeLogProject,
  _release: ChangeLogRelease
): Promise<ChangeLogNotes[]> {
  logger.trace('gitlab.getReleaseNotesMd()');
  // TODO #7154
  const apiBaseUrl = project.apiBaseUrl!;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const repository = project.repository!;
  const urlEncodedRepo = encodeURIComponent(repository);
  const apiUrl = `${ensureTrailingSlash(
    apiBaseUrl
  )}projects/${urlEncodedRepo}/releases`;

  const res = await http.getJson<GitlabRelease[]>(`${apiUrl}?per_page=100`, {
    paginate: true,
  });
  return res.body.map((release) => ({
    url: `${apiUrl}/${release.tag_name}`,
    notesSourceUrl: apiUrl,
    name: release.name,
    body: release.description,
    tag: release.tag_name,
  }));
}
