import path from 'node:path';
import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger';
import type { AzureTreeNode } from '../../../../../../modules/platform/azure/schema';
import {
  AzureTree,
  ItemResponse,
} from '../../../../../../modules/platform/azure/schema';
import { AzureHttp } from '../../../../../../util/http/azure';
import { ensureTrailingSlash } from '../../../../../../util/url';
import { compareChangelogFilePath } from '../common';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types';

export const id = 'azure-changelog';
const http = new AzureHttp(id);

export function getReleaseList(
  _project: ChangeLogProject,
  _release: ChangeLogRelease,
): ChangeLogNotes[] {
  logger.trace('azure.getReleaseList()');
  logger.info('Unsupported Azure DevOps feature.  Skipping release fetching.');
  return [];
}

export async function getReleaseNotesMd(
  repository: string,
  apiBaseUrl: string,
  sourceDirectory = '/',
): Promise<ChangeLogFile | null> {
  logger.trace('azure.getReleaseNotesMd()');

  const urlEncodedRepo = encodeURIComponent(repository);
  const apiPrefix = `${ensureTrailingSlash(
    apiBaseUrl,
  )}git/repositories/${urlEncodedRepo}/`;

  const sourceDirectoryId = (
    await http.getJson(
      `${apiPrefix}items?path=${sourceDirectory}&api-version=7.0`,
      {
        paginate: false,
      },
      ItemResponse,
    )
  ).body.objectId;

  const tree = (
    await http.getJson(
      `${apiPrefix}trees/${sourceDirectoryId}?api-version=7.0`,
      {},
      AzureTree,
    )
  ).body.treeEntries;

  const allFiles = tree.filter((f) => f.gitObjectType === 'blob');

  let files: AzureTreeNode[] = [];
  if (!files.length) {
    files = allFiles.filter((f) =>
      changelogFilenameRegex.test(path.basename(f.relativePath)),
    );
  }

  if (!files.length) {
    logger.trace('no changelog file found');
    return null;
  }

  let changelogFile = files
    .sort((a, b) => compareChangelogFilePath(a.relativePath, b.relativePath))
    .shift()?.relativePath;

  changelogFile = `${sourceDirectory ? ensureTrailingSlash(sourceDirectory) : ''}${changelogFile}`;

  const fileRes = await http.get(
    `${apiPrefix}items?path=${changelogFile}&includeContent=true&api-version=7.0`,
  );

  const changelogMd = fileRes.body.toString('utf8') + '\n#\n##';
  return { changelogFile, changelogMd };
}
