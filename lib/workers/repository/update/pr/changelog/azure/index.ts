import type { GitTreeEntryRef } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { GitObjectType } from 'azure-devops-node-api/interfaces/GitInterfaces';
import changelogFilenameRegex from 'changelog-filename-regex';
import upath from 'upath';
import { logger } from '../../../../../../logger';
import * as azureHelper from '../../../../../../modules/platform/azure/azure-helper';
import { ensureTrailingSlash } from '../../../../../../util/url';
import { compareChangelogFilePath } from '../common';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types';

export const id = 'azure-changelog';

export function getReleaseList(
  _project: ChangeLogProject,
  _release: ChangeLogRelease,
): ChangeLogNotes[] {
  logger.trace('azure.getReleaseList()');
  logger.debug('Unsupported Azure DevOps feature.  Skipping release fetching.');
  return [];
}

export async function getReleaseNotesMd(
  repository: string,
  apiBaseUrl: string,
  sourceDirectory = '/',
): Promise<ChangeLogFile | null> {
  logger.trace('azure.getReleaseNotesMd()');

  const urlEncodedRepo = encodeURIComponent(repository);

  const sourceDirectoryId = await azureHelper.getItem(
    urlEncodedRepo,
    sourceDirectory,
  );

  const tree = await azureHelper.getTrees(
    urlEncodedRepo,
    sourceDirectoryId.objectId!,
  );

  const allFiles = tree.treeEntries?.filter(
    (f) => f.gitObjectType === GitObjectType.Blob,
  );

  if (!allFiles?.length) {
    logger.trace('no files found in repository');
    return null;
  }

  let files: GitTreeEntryRef[] = [];
  if (!files.length) {
    files = allFiles.filter((f) =>
      changelogFilenameRegex.test(upath.basename(f.relativePath ?? '')),
    );
  }

  if (!files.length) {
    logger.trace('no changelog file found');
    return null;
  }

  let changelogFile = files
    .sort((a, b) => compareChangelogFilePath(a.relativePath!, b.relativePath!))
    .shift()?.relativePath;

  /* v8 ignore next -- not testable */
  changelogFile = `${sourceDirectory ? ensureTrailingSlash(sourceDirectory) : ''}${changelogFile}`;

  const fileRes = await azureHelper.getItem(
    urlEncodedRepo,
    changelogFile,
    true,
  );

  if (!fileRes?.content) {
    logger.trace('no changelog file found');
    return null;
  }

  const changelogMd = fileRes.content + '\n#\n##';
  return { changelogFile, changelogMd };
}
