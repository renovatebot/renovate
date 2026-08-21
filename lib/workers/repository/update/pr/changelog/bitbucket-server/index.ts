import path from 'node:path';
import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger/index.ts';
import { Files } from '../../../../../../modules/platform/bitbucket-server/schema.ts';
import { BitbucketServerHttp } from '../../../../../../util/http/bitbucket-server.ts';
import {
  ensureTrailingSlash,
  joinUrlParts,
} from '../../../../../../util/url.ts';
import { compareChangelogFilePath } from '../common.ts';
import type { ChangeLogFile } from '../types.ts';

export const id = 'bitbucket-server-changelog';
const http = new BitbucketServerHttp(id);

export async function getReleaseNotesMd(
  repository: string,
  apiBaseUrl: string,
  sourceDirectory?: string,
): Promise<ChangeLogFile | null> {
  logger.info('bitbucketServer.getReleaseNotesMd()');

  const [projectKey, repositorySlug] = repository.split('/');
  const apiRepoBaseUrl = joinUrlParts(
    apiBaseUrl,
    `projects`,
    projectKey,
    'repos',
    repositorySlug,
  );

  const repositorySourceURl = joinUrlParts(
    apiRepoBaseUrl,
    'files',
    sourceDirectory ?? '',
  );
  const allFiles = (
    await http.getJson(
      repositorySourceURl,
      {
        paginate: true,
      },
      Files,
    )
  ).body;

  const changelogFiles = allFiles.filter((f) =>
    changelogFilenameRegex.test(path.basename(f)),
  );

  let changelogFile = changelogFiles
    .sort((a, b) => compareChangelogFilePath(a, b))
    .shift();
  if (!changelogFile) {
    logger.trace('no changelog file found');
    return null;
  }

  changelogFile = `${sourceDirectory ? ensureTrailingSlash(sourceDirectory) : ''}${changelogFile}`;
  if (changelogFiles.length !== 0) {
    logger.debug(
      `Multiple candidates for changelog file, using ${changelogFile}`,
    );
  }

  const fileRes = await http.getText(
    joinUrlParts(apiRepoBaseUrl, 'raw', changelogFile),
  );
  const changelogMd = `${fileRes.body}\n#\n##`;

  return { changelogFile, changelogMd };
}
