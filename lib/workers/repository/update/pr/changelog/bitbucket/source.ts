import path from 'node:path';
import { isNullOrUndefined } from '@sindresorhus/is';
import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger/index.ts';
import { PagedSourceResults } from '../../../../../../modules/platform/bitbucket/schema.ts';
import { BitbucketHttp } from '../../../../../../util/http/bitbucket.ts';
import { joinUrlParts } from '../../../../../../util/url.ts';
import type { BranchUpgradeConfig } from '../../../../../types.ts';
import { compareChangelogFilePath } from '../common.ts';
import { ChangeLogSource } from '../source.ts';
import type { ChangeLogFile } from '../types.ts';

export const id = 'bitbucket-changelog';

export class BitbucketChangeLogSource extends ChangeLogSource {
  private readonly http = new BitbucketHttp(id);

  constructor() {
    super('bitbucket', 'bitbucket-tags');
  }

  getAPIBaseUrl(_config: BranchUpgradeConfig): string {
    return 'https://api.bitbucket.org/';
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string,
  ): string {
    return `${baseUrl}${repository}/branches/compare/${nextHead}%0D${prevHead}`;
  }

  override getNotesSourceUrl(
    baseUrl: string,
    repository: string,
    changelogFile: string,
  ): string {
    return joinUrlParts(baseUrl, repository, 'src', 'HEAD', changelogFile);
  }

  async getReleaseNotesMd(
    repository: string,
    apiBaseUrl: string,
    sourceDirectory?: string,
  ): Promise<ChangeLogFile | null> {
    logger.trace('bitbucket.getReleaseNotesMd()');

    const repositorySourceURl = joinUrlParts(
      apiBaseUrl,
      '2.0/repositories',
      repository,
      'src/HEAD',
      sourceDirectory ?? '',
    );

    const rootFiles = (
      await this.http.getJson(
        repositorySourceURl,
        {
          paginate: true,
        },
        PagedSourceResults,
      )
    ).body.values;

    const allFiles = rootFiles.filter((f) => f.type === 'commit_file');

    const files = allFiles.filter((f) =>
      changelogFilenameRegex.test(path.basename(f.path)),
    );

    const changelogFile = files
      .sort((a, b) => compareChangelogFilePath(a.path, b.path))
      .shift();
    if (isNullOrUndefined(changelogFile)) {
      logger.trace('no changelog file found');
      return null;
    }

    if (files.length !== 0) {
      logger.debug(
        `Multiple candidates for changelog file, using ${changelogFile.path}`,
      );
    }

    const fileRes = await this.http.getText(
      joinUrlParts(
        apiBaseUrl,
        '2.0/repositories',
        repository,
        'src',
        changelogFile.commit.hash,
        changelogFile.path,
      ),
    );

    const changelogMd = `${fileRes.body}\n#\n##`;
    return { changelogFile: changelogFile.path, changelogMd };
  }
}
