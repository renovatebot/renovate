import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger/index.ts';
import { Releases } from '../../../../../../modules/datasource/forgejo-releases/schema.ts';
import {
  ContentsListResponse,
  RepoContents,
} from '../../../../../../modules/platform/forgejo/schema.ts';
import { ForgejoHttp } from '../../../../../../util/http/forgejo.ts';
import { fromBase64 } from '../../../../../../util/string.ts';
import type { BranchUpgradeConfig } from '../../../../../types.ts';
import { compareChangelogFilePath } from '../common.ts';
import { ChangeLogSource } from '../source.ts';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types.ts';

export const id = 'forgejo-changelog';

export class ForgejoChangeLogSource extends ChangeLogSource {
  private readonly http = new ForgejoHttp(id);

  constructor() {
    super('forgejo', 'forgejo-tags');
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
    logger.trace('forgejo.getReleaseNotesMd()');
    const apiPrefix = `${apiBaseUrl}repos/${repository}/contents`;

    const sourceDir = sourceDirectory ? `/${sourceDirectory}` : '';
    const tree = (
      await this.http.getJson(
        `${apiPrefix}${sourceDir}`,
        {
          paginate: false, // no pagination yet
        },
        ContentsListResponse,
      )
    ).body;
    const allFiles = tree.filter((f) => f.type === 'file');
    let files: RepoContents[] = [];
    if (!files.length) {
      files = allFiles.filter((f) => changelogFilenameRegex.test(f.name));
    }
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

    const fileRes = await this.http.getJson(
      `${apiPrefix}/${changelogFile}`,
      RepoContents,
    );
    // istanbul ignore if: should never happen
    if (fileRes.body.type !== 'file' || !fileRes.body.content) {
      logger.debug(
        `Missing content for changelog file, using ${changelogFile}`,
      );
      return null;
    }
    const changelogMd = `${fromBase64(fileRes.body.content)}\n#\n##`;

    return { changelogFile, changelogMd };
  }

  override async getReleaseList(
    project: ChangeLogProject,
    _release: ChangeLogRelease,
  ): Promise<ChangeLogNotes[]> {
    logger.trace('forgejo.getReleaseList()');
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
