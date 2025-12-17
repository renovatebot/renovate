import is from '@sindresorhus/is';
import semver from 'semver';
import { parseUrl } from '../../../../util/url';
import { GithubReleasesDatasource } from '../../../datasource/github-releases';
import { GithubTagsDatasource } from '../../../datasource/github-tags';
import type { PackageDependency } from '../../types';
import { HomebrewUrlHandler } from './base';

export type GitHubUrlType = 'archive' | 'releases';

// URL parsing result with urlType for datasource selection
export interface GitHubUrlParsedResult {
  type: 'github';
  currentValue: string;
  ownerName: string;
  repoName: string;
  urlType: GitHubUrlType;
}

// Manager data with type discriminator
export interface GitHubManagerData {
  type: 'github';
  ownerName: string;
  repoName: string;
  sha256: string | null;
  url: string | null;
}

export class GitHubUrlHandler extends HomebrewUrlHandler {
  readonly type = 'github';

  parseUrl(urlStr: string): GitHubUrlParsedResult | null {
    if (!is.nonEmptyString(urlStr)) {
      return null;
    }
    const url = parseUrl(urlStr);
    if (url?.hostname !== 'github.com') {
      return null;
    }
    let s = url.pathname.split('/');
    s = s.filter((val) => val);
    const ownerName = s[0];
    const repoName = s[1];
    let currentValue: string | undefined;
    let urlType: GitHubUrlType | undefined;

    if (s[2] === 'archive') {
      urlType = 'archive';
      // old archive url in form: [...]/archive/<tag>.tar.gz
      currentValue = s[3];
      if (currentValue === 'refs') {
        // new archive url in form: [...]/archive/refs/tags/<tag>.tar.gz
        currentValue = s[5];
      }
      const targz = currentValue.slice(
        currentValue.length - 7,
        currentValue.length,
      );
      if (targz === '.tar.gz') {
        currentValue = currentValue.substring(0, currentValue.length - 7);
      }
    } else if (s[2] === 'releases' && s[3] === 'download') {
      urlType = 'releases';
      currentValue = s[4];
    }

    if (!currentValue || !urlType) {
      return null;
    }

    return { type: 'github', currentValue, ownerName, repoName, urlType };
  }

  createDependency(
    parsed: GitHubUrlParsedResult,
    sha256: string | null,
    url: string,
  ): PackageDependency<GitHubManagerData> {
    return {
      depName: `${parsed.ownerName}/${parsed.repoName}`,
      currentValue: parsed.currentValue,
      datasource:
        parsed.urlType === 'releases'
          ? GithubReleasesDatasource.id
          : GithubTagsDatasource.id,
      managerData: {
        type: 'github',
        ownerName: parsed.ownerName,
        repoName: parsed.repoName,
        sha256,
        url,
      },
    };
  }

  buildArchiveUrls(
    managerData: GitHubManagerData,
    newVersion: string,
  ): string[] | null {
    const ownerName = managerData.ownerName;
    const repoName = managerData.repoName;

    // Use semver.coerce to get version without 'v' prefix for filename
    const coercedVersion = semver.coerce(newVersion);
    const versionForFilename = coercedVersion?.version ?? newVersion;

    return [
      `https://github.com/${ownerName}/${repoName}/releases/download/${newVersion}/${repoName}-${versionForFilename}.tar.gz`,
      `https://github.com/${ownerName}/${repoName}/archive/refs/tags/${newVersion}.tar.gz`,
    ];
  }
}
