import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger';
import type { GitlabRelease } from '../../../../../../modules/datasource/gitlab-releases/types';
import type { GitlabTreeNode } from '../../../../../../types/platform/gitlab';
import { GitlabHttp } from '../../../../../../util/http/gitlab';
import type { BranchUpgradeConfig } from '../../../../../types';
import { ChangeLogSource } from '../source';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types';

export const id = 'gitlab-changelog';
const http = new GitlabHttp(id);

export class GitLabChangeLogSource extends ChangeLogSource {
  constructor() {
    super('gitlab', 'gitlab-tags');
  }

  getAPIBaseUrl(config: BranchUpgradeConfig): string {
    return this.getBaseUrl(config) + 'api/v4/';
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string
  ): string {
    return `${baseUrl}${repository}/compare/${prevHead}...${nextHead}`;
  }

  override hasValidRepository(repository: string): boolean {
    return repository.split('/').length >= 2;
  }

  override async getChangeLogFile(
    repository: string,
    apiBaseUrl: string,
    sourceDirectory?: string
  ): Promise<ChangeLogFile | null> {
    logger.trace('gitlab.getReleaseNotesMd()');
    const urlEncodedRepo = encodeURIComponent(repository);
    const apiPrefix = `${apiBaseUrl}projects/${urlEncodedRepo}/repository/`;

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

  override async getReleaseList(
    project: ChangeLogProject,
    _release: ChangeLogRelease
  ): Promise<ChangeLogNotes[]> {
    logger.trace('gitlab.getReleaseNotesMd()');
    const apiBaseUrl = project.apiBaseUrl;
    const repository = project.repository;
    const urlEncodedRepo = encodeURIComponent(repository);
    const apiUrl = `${apiBaseUrl}projects/${urlEncodedRepo}/releases`;

    const res = await http.getJson<GitlabRelease[]>(`${apiUrl}?per_page=100`, {
      paginate: true,
    });
    return res.body.map((release) => ({
      url: `${project.baseUrl}${repository}/-/releases/${release.tag_name}`,
      notesSourceUrl: apiUrl,
      name: release.name,
      body: release.description,
      tag: release.tag_name,
    }));
  }
}
