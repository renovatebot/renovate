import is from '@sindresorhus/is';
import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger';
import { BitbucketTagsDatasource } from '../../../../../../modules/datasource/bitbucket-tags';
import type {
  BitbucketSourceResults,
  PagedResult,
} from '../../../../../../modules/platform/bitbucket/types';
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
const bitbucketTags = new BitbucketTagsDatasource();

export async function getReleaseNotesMd(
  repository: string,
  apiBaseUrl: string,
  sourceDirectory?: string
): Promise<ChangeLogFile | null> {
  logger.trace('bitbucket.getReleaseNotesMd()');

  const repositorySourceURl = joinUrlParts(
    apiBaseUrl,
    `2.0/repositories`,
    repository,
    'src'
  );

  const rootFiles = (
    await bitbucketHttp.getJson<PagedResult<BitbucketSourceResults>>(
      repositorySourceURl,
      {
        paginate: true,
      }
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
      `Multiple candidates for changelog file, using ${changelogFile.path}`
    );
  }

  const fileRes = await bitbucketHttp.get(
    joinUrlParts(
      repositorySourceURl,
      changelogFile.commit.hash,
      changelogFile.path
    )
  );

  const changelogMd = fileRes.body + '\n#\n##';
  return { changelogFile: changelogFile.path, changelogMd };
}

export async function getTags(repository: string): Promise<string[]> {
  logger.trace('bitbucket.getTags()');
  try {
    const tags = (
      await bitbucketTags.getReleases({
        packageName: repository,
      })
    )?.releases;

    // istanbul ignore if
    if (is.nullOrUndefined(tags) || is.emptyArray(tags)) {
      logger.debug(`No Bitbucket tags found for repository:${repository}`);

      return [];
    }

    return [];
  } catch (err) {
    logger.debug(
      { sourceRepo: repository, err },
      'Failed to fetch Bitbucket tags'
    );

    return [];
  }
}

export function getReleaseList(
  project: ChangeLogProject,
  _release: ChangeLogRelease
): ChangeLogNotes[] {
  logger.trace('github.getReleaseList()');
  logger.warn('TODO: implement getReleaseList() for Bitbucket');
  return [];
}
