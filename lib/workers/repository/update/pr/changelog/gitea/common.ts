import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger/index.ts';
import { Releases } from '../../../../../../modules/datasource/gitea-releases/schema.ts';
import {
  ContentsListResponse,
  RepoContents,
} from '../../../../../../modules/platform/gitea/schema.ts';
import type { GiteaHttp } from '../../../../../../util/http/gitea.ts';
import { compareChangelogFilePath } from '../common.ts';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types.ts';

export interface GiteaChangelogApi {
  getReleaseNotesMd: (
    repository: string,
    apiBaseUrl: string,
    sourceDirectory?: string,
  ) => Promise<ChangeLogFile | null>;
  getReleaseList: (
    project: ChangeLogProject,
    release: ChangeLogRelease,
  ) => Promise<ChangeLogNotes[]>;
}

/**
 * Builds the changelog functions of a platform which speaks the Gitea API.
 *
 * Forgejo is a fork of Gitea and serves the same API, so the Gitea and Forgejo
 * modules only differ in the Http client they pass in.
 */
export function createChangelogApi(
  id: string,
  http: GiteaHttp,
): GiteaChangelogApi {
  async function getReleaseNotesMd(
    repository: string,
    apiBaseUrl: string,
    sourceDirectory?: string,
  ): Promise<ChangeLogFile | null> {
    logger.trace({ id }, 'getReleaseNotesMd()');
    const apiPrefix = `${apiBaseUrl}repos/${repository}/contents`;

    const sourceDir = sourceDirectory ? `/${sourceDirectory}` : '';
    const tree = (
      await http.getJson(
        `${apiPrefix}${sourceDir}`,
        {
          paginate: false, // no pagination yet
        },
        ContentsListResponse,
      )
    ).body;
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

    const fileRes = await http.getJson(
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
    const changelogMd = `${fileRes.body.contentString}\n#\n##`;

    return { changelogFile, changelogMd };
  }

  async function getReleaseList(
    project: ChangeLogProject,
    _release: ChangeLogRelease,
  ): Promise<ChangeLogNotes[]> {
    logger.trace({ id }, 'getReleaseList()');
    const apiUrl = `${project.apiBaseUrl}repos/${project.repository}/releases`;

    const res = await http.getJson(
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

  return { getReleaseNotesMd, getReleaseList };
}
