import path from 'node:path';
import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../../../../logger/index.ts';
import { Files } from '../../../../../../modules/platform/bitbucket-server/schema.ts';
import { BitbucketServerHttp } from '../../../../../../util/http/bitbucket-server.ts';
import { regEx } from '../../../../../../util/regex.ts';
import {
  ensureTrailingSlash,
  joinUrlParts,
  parseUrl,
} from '../../../../../../util/url.ts';
import type { BranchUpgradeConfig } from '../../../../../types.ts';
import { compareChangelogFilePath } from '../common.ts';
import { ChangeLogSource } from '../source.ts';
import type { ChangeLogFile } from '../types.ts';

export const id = 'bitbucket-server-changelog';

const subfolderRegex = regEx('(?<subfolder>.+/)(?:projects|scm)/');
const gitUrlRegex = regEx('/(?<project>[^/]+)/(?<repo>[^/]+)\\.git$');
const webUrlRegex = regEx('/projects/(?<project>[^/]+)/repos/(?<repo>[^/]+)');

export class BitbucketServerChangeLogSource extends ChangeLogSource {
  private readonly http = new BitbucketServerHttp(id);

  constructor() {
    super('bitbucket-server', 'bitbucket-server-tags');
  }

  override getBaseUrl(config: BranchUpgradeConfig): string {
    const parsedUrl = parseUrl(config.sourceUrl);
    if (parsedUrl?.host) {
      const protocol = parsedUrl.protocol.replace(regEx(/^git\+/), '');
      const match = subfolderRegex.exec(parsedUrl.pathname);
      const subfolder = match?.groups?.subfolder ?? '/';

      return `${protocol}//${parsedUrl.host}${subfolder}`;
    }

    return '';
  }

  getAPIBaseUrl(config: BranchUpgradeConfig): string {
    return `${this.getBaseUrl(config)}rest/api/1.0/`;
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string,
  ): string {
    const [projectKey, repositorySlug] = repository.split('/');
    return `${baseUrl}projects/${projectKey}/repos/${repositorySlug}/compare/commits?sourceBranch=${nextHead}&targetBranch=${prevHead}`;
  }

  override getRepositoryFromUrl(config: BranchUpgradeConfig): string {
    const parsedUrl = parseUrl(config.sourceUrl);
    if (parsedUrl) {
      const repositoryRegex = parsedUrl.pathname.endsWith('.git')
        ? gitUrlRegex
        : webUrlRegex;
      const match = repositoryRegex.exec(parsedUrl.pathname);
      if (match?.groups) {
        return `${match.groups.project}/${match.groups.repo}`;
      }
    }

    return '';
  }

  override getNotesSourceUrl(
    baseUrl: string,
    repository: string,
    changelogFile: string,
  ): string {
    const [projectKey, repositorySlug] = repository.split('/');
    return joinUrlParts(
      baseUrl,
      'projects',
      projectKey,
      'repos',
      repositorySlug,
      'browse',
      changelogFile,
      '?at=HEAD',
    );
  }

  async getReleaseNotesMd(
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
      await this.http.getJson(
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

    const fileRes = await this.http.getText(
      joinUrlParts(apiRepoBaseUrl, 'raw', changelogFile),
    );
    const changelogMd = `${fileRes.body}\n#\n##`;

    return { changelogFile, changelogMd };
  }
}
