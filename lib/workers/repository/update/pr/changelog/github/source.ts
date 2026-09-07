import changelogFilenameRegex from 'changelog-filename-regex';
import { GlobalConfig } from '../../../../../../config/global.ts';
import { logger } from '../../../../../../logger/index.ts';
import type {
  GithubGitBlob,
  GithubGitTree,
  GithubGitTreeNode,
} from '../../../../../../types/platform/github/index.ts';
import { queryReleases } from '../../../../../../util/github/graphql/index.ts';
import * as hostRules from '../../../../../../util/host-rules.ts';
import { memCacheProvider } from '../../../../../../util/http/cache/memory-http-cache-provider.ts';
import { GithubHttp } from '../../../../../../util/http/github.ts';
import { fromBase64 } from '../../../../../../util/string.ts';
import {
  ensureTrailingSlash,
  joinUrlParts,
  parseUrl,
} from '../../../../../../util/url.ts';
import type { BranchUpgradeConfig } from '../../../../../types.ts';
import { compareChangelogFilePath } from '../common.ts';
import { ChangeLogSource } from '../source.ts';
import type {
  ChangeLogError,
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
} from '../types.ts';

export const id = 'github-changelog';

export class GitHubChangeLogSource extends ChangeLogSource {
  private readonly http = new GithubHttp(id);

  constructor() {
    super('github', 'github-tags');
  }

  getAPIBaseUrl(config: BranchUpgradeConfig): string {
    const baseUrl = this.getBaseUrl(config);
    return baseUrl.startsWith('https://github.com/')
      ? 'https://api.github.com/'
      : `${baseUrl}api/v3/`;
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string,
  ): string {
    return `${baseUrl}${repository}/compare/${prevHead}...${nextHead}`;
  }

  protected override shouldSkipPackage(config: BranchUpgradeConfig): boolean {
    if (
      config.sourceUrl === 'https://github.com/DefinitelyTyped/DefinitelyTyped'
    ) {
      logger.trace('No release notes for @types');
      return true;
    }

    return false;
  }

  protected override hasValidToken(config: BranchUpgradeConfig): {
    isValid: boolean;
    error?: ChangeLogError;
  } {
    const sourceUrl = config.sourceUrl!;
    const host = parseUrl(sourceUrl)?.host;
    const manager = config.manager;
    const packageName = config.packageName;

    const url = sourceUrl.startsWith('https://github.com/')
      ? 'https://api.github.com/'
      : sourceUrl;
    const { token } = hostRules.find({
      hostType: 'github',
      url,
      readOnly: true,
    });
    // istanbul ignore if
    if (host && !token) {
      if (host.endsWith('.github.com') || host === 'github.com') {
        if (!GlobalConfig.get('githubTokenWarn')) {
          logger.debug(
            { manager, packageName, sourceUrl },
            'GitHub token warning has been suppressed. Skipping release notes retrieval',
          );
          return { isValid: false };
        }
        logger.warn(
          { manager, packageName, sourceUrl },
          'No github.com token has been configured. Skipping release notes retrieval',
        );
        return { isValid: false, error: 'MissingGithubToken' };
      }
      logger.debug(
        { manager, packageName, sourceUrl },
        'Repository URL does not match any known github hosts - skipping changelog retrieval',
      );
      return { isValid: false };
    }
    return { isValid: true };
  }

  async getReleaseNotesMd(
    repository: string,
    apiBaseUrl: string,
    sourceDirectory?: string,
  ): Promise<ChangeLogFile | null> {
    logger.trace('github.getReleaseNotesMd()');
    const apiPrefix = `${ensureTrailingSlash(apiBaseUrl)}repos/${repository}`;
    const { default_branch: defaultBranch = 'HEAD' } = (
      await this.http.getJsonUnchecked<{ default_branch?: string }>(apiPrefix, {
        cacheProvider: memCacheProvider,
      })
    ).body;

    // https://docs.github.com/en/rest/reference/git#get-a-tree
    const res = await this.http.getJsonUnchecked<GithubGitTree>(
      `${apiPrefix}/git/trees/${defaultBranch}${
        sourceDirectory ? '?recursive=1' : ''
      }`,
      { cacheProvider: memCacheProvider },
    );

    // istanbul ignore if
    if (res.body.truncated) {
      logger.debug(`Git tree truncated repository:${repository}`);
    }

    const allFiles = res.body.tree.filter((f) => f.type === 'blob');
    let files: GithubGitTreeNode[] = [];

    if (sourceDirectory?.length) {
      files = allFiles
        .filter((f) => f.path.startsWith(sourceDirectory))
        .filter((f) =>
          changelogFilenameRegex.test(
            f.path.replace(ensureTrailingSlash(sourceDirectory), ''),
          ),
        );
    }
    if (!files.length) {
      files = allFiles.filter((f) => changelogFilenameRegex.test(f.path));
    }
    if (!files.length) {
      logger.trace('no changelog file found');
      return null;
    }
    const { path: changelogFile, sha } = files
      .sort((a, b) => compareChangelogFilePath(a.path, b.path))
      .shift()!;
    /* istanbul ignore if */
    if (files.length !== 0) {
      logger.debug(
        `Multiple candidates for changelog file, using ${changelogFile}`,
      );
    }

    // https://docs.github.com/en/rest/reference/git#get-a-blob
    const fileRes = await this.http.getJsonUnchecked<GithubGitBlob>(
      `${apiPrefix}/git/blobs/${sha}`,
      { cacheProvider: memCacheProvider },
    );

    const changelogMd = `${fromBase64(fileRes.body.content)}\n#\n##`;
    return { changelogFile, changelogMd };
  }

  override async getReleaseList(
    project: ChangeLogProject,
    _release: ChangeLogRelease,
  ): Promise<ChangeLogNotes[]> {
    logger.trace('github.getReleaseList()');
    const apiBaseUrl = project.apiBaseUrl;
    const repository = project.repository;
    const notesSourceUrl = joinUrlParts(
      apiBaseUrl,
      'repos',
      repository,
      'releases',
    );
    const releases = await queryReleases(
      {
        registryUrl: apiBaseUrl,
        packageName: repository,
      },
      this.http,
    );

    const result = releases.map(
      ({ url, id: releaseId, version: tag, name, description: body }) => ({
        url,
        notesSourceUrl,
        id: releaseId,
        tag,
        name,
        body,
      }),
    );
    return result;
  }
}
