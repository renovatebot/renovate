import is from '@sindresorhus/is';
import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger';
import { PagedSourceResultsSchema } from '../../../../../../modules/platform/bitbucket/schema';
import { BitbucketHttp } from '../../../../../../util/http/bitbucket';
import { joinUrlParts } from '../../../../../../util/url';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types';

export const id = 'bitbucket-changelog';
const bitbucketHttp = new BitbucketHttp(id);

export async function getReleaseNotesMd(
  repository: string,
  apiBaseUrl: string,
  _sourceDirectory?: string,
): Promise<ChangeLogFile | null> {
  logger.trace('bitbucket.getReleaseNotesMd()');

  const repositorySourceURl = joinUrlParts(
    apiBaseUrl,
    `2.0/repositories`,
    repository,
    'src',
  );

  const rootFiles = (
    await bitbucketHttp.getJson(
      repositorySourceURl,
      {
        paginate: true,
      },
      PagedSourceResultsSchema,
    )
  ).body.values;

  const allFiles = rootFiles.filter((f) => f.type === 'commit_file');

  const files = allFiles.filter((f) => changelogFilenameRegex.test(f.path));

  const changelogFile = files.shift();
  if (is.nullOrUndefined(changelogFile)) {
    logger.trace('no changelog file found');
    return null;
  }

  if (files.length !== 0) {
    logger.debug(
      `Multiple candidates for changelog file, using ${changelogFile.path}`,
    );
  }

  const fileRes = await bitbucketHttp.get(
    joinUrlParts(
      repositorySourceURl,
      changelogFile.commit.hash,
      changelogFile.path,
    ),
  );

  const changelogMd = `${fileRes.body}\n#\n##`;
  return { changelogFile: changelogFile.path, changelogMd };
}

export function getReleaseList(
  _project: ChangeLogProject,
  _release: ChangeLogRelease,
): ChangeLogNotes[] {
  logger.trace('bitbucket.getReleaseList()');
  logger.info(
    'Unsupported Bitbucket Cloud feature.  Skipping release fetching.',
  );
  return [];
}
