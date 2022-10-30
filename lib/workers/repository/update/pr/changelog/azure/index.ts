import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger';
import type {
  AzureItem,
  AzureTag,
  AzureTree,
  AzureTreeNode,
} from '../../../../../../types/platform/azure';
import { AzureHttp } from '../../../../../../util/http/azure';
import { ensureTrailingSlash } from '../../../../../../util/url';
import type { ChangeLogFile } from '../types';

export const id = 'azure-changelog';
const http = new AzureHttp(id);

export async function getTags(
  endpoint: string,
  repository: string
): Promise<string[]> {
  logger.trace('azure.getTags()');
  const urlEncodedRepo = encodeURIComponent(repository);
  const url = `${ensureTrailingSlash(
    endpoint
  )}git/repositories/${urlEncodedRepo}/refs?filter=tags&$top=2`;
  try {
    const res = await http.getJsonPaginated<AzureTag>(url);
    const tags = res.body.value;

    if (!tags.length) {
      logger.debug(
        { sourceRepo: repository },
        'repository has no Azure DevOps tags'
      );
    }

    return tags.map((tag) => tag.name).filter(Boolean);
  } catch (err) {
    logger.debug(
      { sourceRepo: repository, err },
      'Failed to fetch Azure DevOps tags'
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
  logger.trace('azure.getReleaseNotesMd()');
  const urlEncodedRepo = encodeURIComponent(repository);
  const apiPrefix = `${ensureTrailingSlash(
    apiBaseUrl
  )}git/repositories/${urlEncodedRepo}/`;

  const sourceDirectoryId: string = (
    await http.getJson<AzureItem>(
      `${apiPrefix}items${
        sourceDirectory ? `?path=${sourceDirectory}` : '?path=/'
      }`
    )
  ).body.objectId;

  const tree: AzureTreeNode[] = (
    await http.getJson<AzureTree>(
      `${apiPrefix}trees/${sourceDirectoryId}`
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
  const changelogFile = sourceDirectory ? `${sourceDirectory}/${relativeChangelogFile}` : `${relativeChangelogFile}`;
  /* istanbul ignore if */
  if (files.length !== 0) {
    logger.debug(
      `Multiple candidates for changelog file, using ${changelogFile}`
    );
  }

  const fileRes = await http.get(
    `${apiPrefix}items?path=${changelogFile}&includeContent=true&api-version=6.0`
  );
  const changelogMd = fileRes.body + '\n#\n##';
  return { changelogFile, changelogMd };
}
