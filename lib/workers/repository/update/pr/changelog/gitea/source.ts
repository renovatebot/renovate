import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger/index.ts';
import { Releases } from '../../../../../../modules/datasource/gitea-releases/schema.ts';
import {
  getRepoFile,
  listRepoDir,
} from '../../../../../../util/gitea/contents.ts';
import { GiteaHttp } from '../../../../../../util/http/gitea.ts';
import type { BranchUpgradeConfig } from '../../../../../types.ts';
import { compareChangelogFilePath } from '../common.ts';
import { ChangeLogSource } from '../source.ts';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types.ts';

export const id = 'gitea-changelog';

export class GiteaChangeLogSource extends ChangeLogSource {
  /**
   * Forgejo is a fork of Gitea and serves the same API, so it inherits every
   * method below and only replaces the Http client.
   */
  protected readonly http: GiteaHttp = new GiteaHttp(id);

  /** Platforms which speak the Gitea API pass their own ids. */
  constructor(
    platform: 'gitea' | 'forgejo' = 'gitea',
    datasource: 'gitea-tags' | 'forgejo-tags' = 'gitea-tags',
  ) {
    super(platform, datasource);
  }

  getAPIBaseUrl(config: BranchUpgradeConfig): string {
    return `${this.getBaseUrl(config)}api/v1/`;
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string,
  ): string {
    return `${baseUrl}${repository}/compare/${prevHead}...${nextHead}`;
  }

  override hasValidRepository(repository: string): boolean {
    return repository.split('/').length === 2;
  }

  async getReleaseNotesMd(
    repository: string,
    apiBaseUrl: string,
    sourceDirectory?: string,
  ): Promise<ChangeLogFile | null> {
    logger.trace(`${this.platform}.getReleaseNotesMd()`);
    const tree = await listRepoDir(
      this.http,
      apiBaseUrl,
      repository,
      sourceDirectory,
      {
        paginate: false, // no pagination yet
      },
    );
    const files = tree.filter(
      (f) => f.type === 'file' && changelogFilenameRegex.test(f.name),
    );
    if (!files.length) {
      logger.trace('no changelog file found');
      return null;
    }

    const { path: changelogFile } = files
      .sort((a, b) => compareChangelogFilePath(a.path, b.path))
      .shift()!;
    /* istanbul ignore if */
    if (files.length !== 0) {
      logger.debug(
        `Multiple candidates for changelog file, using ${changelogFile}`,
      );
    }

    const fileRes = await getRepoFile(
      this.http,
      apiBaseUrl,
      repository,
      changelogFile,
    );
    // istanbul ignore if: should never happen
    if (fileRes.type !== 'file' || !fileRes.content) {
      logger.debug(
        `Missing content for changelog file, using ${changelogFile}`,
      );
      return null;
    }
    const changelogMd = `${fileRes.contentString}\n#\n##`;

    return { changelogFile, changelogMd };
  }

  override async getReleaseList(
    project: ChangeLogProject,
    _release: ChangeLogRelease,
  ): Promise<ChangeLogNotes[]> {
    logger.trace(`${this.platform}.getReleaseList()`);
    const apiUrl = `${project.apiBaseUrl}repos/${project.repository}/releases`;

    const res = await this.http.getJson(
      `${apiUrl}?draft=false`,
      {
        paginate: true,
      },
      Releases,
    );
    return res.body.map((release) => ({
      url: `${project.baseUrl}${project.repository}/releases/tag/${release.tag_name}`,
      notesSourceUrl: apiUrl,
      name: release.name,
      body: release.body,
      tag: release.tag_name,
    }));
  }
}
