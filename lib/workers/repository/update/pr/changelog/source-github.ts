import URL from 'node:url';
import { GlobalConfig } from '../../../../../config/global';
import { logger } from '../../../../../logger';
import type * as allVersioning from '../../../../../modules/versioning';
import * as hostRules from '../../../../../util/host-rules';
import { regEx } from '../../../../../util/regex';
import type { BranchUpgradeConfig } from '../../../../types';
import { ChangeLogSource } from './source';
import type { ChangeLogResult } from './types';

export class GitHubChangeLogSource extends ChangeLogSource {
  constructor() {
    super('github');
  }

  getAPIBaseUrl(sourceUrl: string): string {
    return sourceUrl.startsWith('https://github.com/')
      ? 'https://api.github.com/'
      : this.getBaseUrl(sourceUrl) + 'api/v3/';
  }

  getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string
  ): string {
    return `${baseUrl}${repository}/branches/compare/${prevHead}%0D${nextHead}`;
  }

  // TODO - Should this be the common logic?
  protected override findTagOfRelease(
    version: allVersioning.VersioningApi,
    packageName: string,
    depNewVersion: string,
    tags: string[]
  ): string | undefined {
    const regex = regEx(`(?:${packageName}|release)[@-]`, undefined, false);
    const exactReleaseRegex = regEx(`${packageName}[@\\-_]v?${depNewVersion}`);
    const exactTagsList = tags.filter((tag) => {
      return exactReleaseRegex.test(tag);
    });
    let tagName: string | undefined;
    if (exactTagsList.length) {
      tagName = exactTagsList
        .filter((tag) => version.isVersion(tag.replace(regex, '')))
        .find((tag) => version.equals(tag.replace(regex, ''), depNewVersion));
    } else {
      tagName = tags
        .filter((tag) => version.isVersion(tag.replace(regex, '')))
        .find((tag) => version.equals(tag.replace(regex, ''), depNewVersion));
    }
    return tagName;
  }

  protected override validateToken(
    sourceUrl: string,
    config: BranchUpgradeConfig
  ): ChangeLogResult | null {
    const parsedUrl = URL.parse(sourceUrl);
    const host = parsedUrl.host!;
    const manager = config.manager;
    const packageName = config.packageName;

    const url = sourceUrl.startsWith('https://github.com/')
      ? 'https://api.github.com/'
      : sourceUrl;
    const { token } = hostRules.find({
      hostType: 'github',
      url,
    });
    // istanbul ignore if
    if (!token) {
      if (host.endsWith('.github.com') || host === 'github.com') {
        if (!GlobalConfig.get('githubTokenWarn')) {
          logger.debug(
            { manager, packageName, sourceUrl },
            'GitHub token warning has been suppressed. Skipping release notes retrieval'
          );
          return null;
        }
        logger.warn(
          { manager, packageName, sourceUrl },
          'No github.com token has been configured. Skipping release notes retrieval'
        );
        return { error: 'MissingGithubToken' };
      }
      logger.debug(
        { manager, packageName, sourceUrl },
        'Repository URL does not match any known github hosts - skipping changelog retrieval'
      );
      return null;
    }

    return null;
  }
}
