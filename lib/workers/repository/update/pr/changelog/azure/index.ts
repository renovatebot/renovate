import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger';
import type {
  AzureItem,
  AzureTree,
  AzureTreeNode,
} from '../../../../../../types/platform/azure';
import { AzureHttp } from '../../../../../../util/http/azure';
import { ensureTrailingSlash } from '../../../../../../util/url';
import type { ChangeLogFile } from '../types';

const id = 'azure-changelog';
const http = new AzureHttp(id);

export async function getReleaseNotesMd(
  repository: string,
  apiBaseUrl: string,
  sourceDirectory = '/'
): Promise<ChangeLogFile | null> {
  logger.trace('azure.getReleaseNotesMd()');
  const urlEncodedRepo = encodeURIComponent(repository);
  const apiPrefix = `${ensureTrailingSlash(
    apiBaseUrl
  )}git/repositories/${urlEncodedRepo}/`;

  const sourceDirectoryId: string = (
    await http.getJson<AzureItem>(
      `${apiPrefix}items?path=${sourceDirectory}&api-version=7.0`
    )
  ).body.objectId;

  const tree: AzureTreeNode[] = (
    await http.getJson<AzureTree>(
      `${apiPrefix}trees/${sourceDirectoryId}?api-version=7.0`
    )
  ).body.treeEntries;
  const allFiles = tree.filter((f) => f.gitObjectType === 'blob');
  let files: AzureTreeNode[] = [];
  if (!files.length) {
    files = allFiles.filter((f) => changelogFilenameRegex.test(f.relativePath));
  }
  if (!files.length) {
    logger.trace('no changelog file found');
    return null;
  }
  const { relativePath: relativeChangelogFile } = files.shift()!;
  const changelogFile = `${sourceDirectory.replace(
    /\/?$/,
    '/'
  )}${relativeChangelogFile}`;
  /* istanbul ignore if */
  if (files.length !== 0) {
    logger.debug(
      `Multiple candidates for changelog file, using ${changelogFile}`
    );
  }

  const fileRes = await http.get(
    `${apiPrefix}items?path=${changelogFile}&includeContent=true&api-version=7.0`
  );
  const changelogMd = fileRes.body + '\n#\n##';
  return { changelogFile, changelogMd };
}
