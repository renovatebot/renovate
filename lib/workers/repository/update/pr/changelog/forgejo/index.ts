import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger';
import { Releases } from '../../../../../../modules/datasource/forgejo-releases/schema';
import {
  ContentsListResponse,
  ContentsResponse,
} from '../../../../../../modules/platform/gitea/schema';
import { ForgejoHttp } from '../../../../../../util/http/forgejo';
import { fromBase64 } from '../../../../../../util/string';
import { compareChangelogFilePath } from '../common';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types';

export const id = 'forgejo-changelog';
const http = new ForgejoHttp(id);

export async function getReleaseNotesMd(
  repository: string,
  apiBaseUrl: string,
  sourceDirectory?: string,
): Promise<ChangeLogFile | null> {
  logger.trace('forgejo.getReleaseNotesMd()');
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
  const allFiles = tree.filter((f) => f.type === 'file');
  let files: ContentsResponse[] = [];
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

  const fileRes = await http.getJson(
    `${apiPrefix}/${changelogFile}`,
    ContentsResponse,
  );
  // istanbul ignore if: should never happen
  if (!fileRes.body.content) {
    logger.debug(`Missing content for changelog file, using ${changelogFile}`);
    return null;
  }
  const changelogMd = fromBase64(fileRes.body.content) + '\n#\n##';

  return { changelogFile, changelogMd };
}

export async function getReleaseList(
  project: ChangeLogProject,
  _release: ChangeLogRelease,
): Promise<ChangeLogNotes[]> {
  logger.trace('forgejo.getReleaseNotesMd()');
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
