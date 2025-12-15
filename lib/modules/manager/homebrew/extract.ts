import { logger } from '../../../logger';
import type { SkipReason } from '../../../types';
import { regEx } from '../../../util/regex';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import type { PackageDependency, PackageFileContent } from '../types';
import type { HomebrewManagerData, UrlPathParsedResult } from './types';

export function parseUrlPath(
  urlStr: string | null | undefined,
): UrlPathParsedResult | null {
  if (!urlStr) {
    return null;
  }
  try {
    const url = new URL(urlStr);
    if (url.hostname !== 'github.com') {
      return null;
    }
    let s = url.pathname.split('/');
    s = s.filter((val) => val);
    const ownerName = s[0];
    const repoName = s[1];
    let currentValue: string | undefined;
    if (s[2] === 'archive') {
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
      currentValue = s[4];
    }
    if (!currentValue) {
      return null;
    }
    return { currentValue, ownerName, repoName };
  } catch {
    return null;
  }
}

export function extractPackageFile(content: string): PackageFileContent | null {
  logger.trace('extractPackageFile()');

  // Extract class name: "class ClassName < Formula"
  const classRegex = regEx(/\bclass\s+(?<className>\w+)\s*<\s*Formula\b/);
  const classMatch = content.match(classRegex);
  if (!classMatch?.groups) {
    logger.debug('Invalid class definition');
    return null;
  }
  const className = classMatch.groups.className;

  // Extract URL: url "..." or url '...'
  const urlRegex = regEx(
    /\burl\s+(?:"(?<urlDouble>[^"]+)"|'(?<urlSingle>[^']+)')/,
  );
  const urlMatch = content.match(urlRegex);
  const url =
    urlMatch?.groups?.urlDouble ?? urlMatch?.groups?.urlSingle ?? null;
  if (!url) {
    logger.debug('Invalid URL field');
  }

  // Parse URL to extract GitHub repo info
  const urlPathResult = parseUrlPath(url);
  let skipReason: SkipReason | undefined;
  let currentValue: string | null = null;
  let ownerName: string | null = null;
  let repoName: string | null = null;
  if (urlPathResult) {
    currentValue = urlPathResult.currentValue;
    ownerName = urlPathResult.ownerName;
    repoName = urlPathResult.repoName;
  } else {
    logger.debug('Error: Unsupported URL field');
    skipReason = 'unsupported-url';
  }

  // Extract SHA256: sha256 "..." or sha256 '...'
  // Match any hex characters (not just exactly 64) to handle invalid cases
  const sha256Regex = regEx(
    /\bsha256\s+(?:"(?<sha256Double>[a-f0-9]+)"|'(?<sha256Single>[a-f0-9]+)')/,
  );
  const sha256Match = content.match(sha256Regex);
  const sha256 =
    sha256Match?.groups?.sha256Double ??
    sha256Match?.groups?.sha256Single ??
    null;
  if (sha256?.length !== 64) {
    logger.debug('Error: Invalid sha256 field');
    skipReason = 'invalid-sha256';
  }

  const dep: PackageDependency<HomebrewManagerData> = {
    depName: `${ownerName}/${repoName}`,
    managerData: { ownerName, repoName, sha256, url },
    currentValue,
    datasource: GithubTagsDatasource.id,
  };
  if (skipReason) {
    dep.skipReason = skipReason;
    if (skipReason === 'unsupported-url') {
      dep.depName = className;
      dep.datasource = undefined;
    }
  }
  const deps = [dep];
  return { deps };
}
