import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger';
import type {
  GithubGitBlob,
  GithubGitTree,
  GithubGitTreeNode,
} from '../../../../../../types/platform/github';
import type {
  GithubRestRelease,
  GithubRestTag,
} from '../../../../../../util/github/types';
import { GithubHttp } from '../../../../../../util/http/github';
import { fromBase64 } from '../../../../../../util/string';
import { ensureTrailingSlash } from '../../../../../../util/url';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types';

export const id = 'github-changelog';
const http = new GithubHttp(id);

export async function getTags(
  endpoint: string,
  repository: string
): Promise<string[]> {
  logger.trace('github.getTags()');
  try {
    const url = `${endpoint}repos/${repository}/tags?per_page=100`;
    const res = await http.getJson<GithubRestTag[]>(url, {
      paginate: true,
    });
    const tags = res.body;

    // istanbul ignore if
    if (!tags.length) {
      logger.debug({ repository }, 'repository has no Github tags');
    }

    return tags.map((tag) => tag.name).filter(Boolean);
  } catch (err) {
    logger.debug(
      { sourceRepo: repository, err },
      'Failed to fetch Github tags'
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
  sourceDirectory: string
): Promise<ChangeLogFile | null> {
  logger.trace('github.getReleaseNotesMd()');
  const apiPrefix = `${ensureTrailingSlash(apiBaseUrl)}repos/${repository}`;
  const { default_branch: defaultBranch = 'HEAD' } = (
    await http.getJson<{ default_branch: string }>(apiPrefix)
  ).body;

  // https://docs.github.com/en/rest/reference/git#get-a-tree
  const res = await http.getJson<GithubGitTree>(
    `${apiPrefix}/git/trees/${defaultBranch}${
      sourceDirectory ? '?recursive=1' : ''
    }`
  );

  // istanbul ignore if
  if (res.body.truncated) {
    logger.debug({ repository }, 'Git tree truncated');
  }

  const allFiles = res.body.tree.filter((f) => f.type === 'blob');
  let files: GithubGitTreeNode[] = [];
  if (sourceDirectory?.length) {
    files = allFiles
      .filter((f) => f.path.startsWith(sourceDirectory))
      .filter((f) =>
        changelogFilenameRegex.test(
          f.path.replace(ensureTrailingSlash(sourceDirectory), '')
        )
      );
  }
  if (!files.length) {
    files = allFiles.filter((f) => changelogFilenameRegex.test(f.path));
  }
  if (!files.length) {
    logger.trace('no changelog file found');
    return null;
  }
  const { path: changelogFile, sha } = files.shift()!;
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

  const changelogMd = fromBase64(fileRes.body.content) + '\n#\n##';
  return { changelogFile, changelogMd };
}

export async function getReleaseList(
  project: ChangeLogProject,
  release: ChangeLogRelease
): Promise<ChangeLogNotes[]> {
  logger.trace('github.getReleaseList()');
  // TODO #7154
  const apiBaseUrl = project.apiBaseUrl!;
  const repository = project.repository;
  const url = `${ensureTrailingSlash(apiBaseUrl)}repos/${repository}/releases`;
  const res = await http.getJson<GithubRestRelease[]>(`${url}?per_page=100`, {
    paginate: true,
  });

  return res.body.map((release) => ({
    url: release.html_url,
    notesSourceUrl: url,
    id: release.id,
    tag: release.tag_name,
    name: release.name,
    body: release.body,
  }));
}
