import is from '@sindresorhus/is';
import { regEx } from '../../../../util/regex';
import { parseUrl } from '../../../../util/url';
import { GithubReleasesDatasource } from '../../../datasource/github-releases';
import { GithubTagsDatasource } from '../../../datasource/github-tags';
import type { PackageDependency } from '../../types';
import type { Target, UrlParsedResult } from '../types';

export function parseArchiveUrl(
  urlString: string | undefined | null
): UrlParsedResult | null {
  if (!urlString) {
    return null;
  }
  const url = parseUrl(urlString);
  if (!url || url.host !== 'github.com' || !url.pathname) {
    return null;
  }
  const path = url.pathname.split('/').slice(1);
  const repo = path[0] + '/' + path[1];
  let datasource = '';
  let currentValue: string | null = null;
  if (path[2] === 'releases' && path[3] === 'download') {
    datasource = GithubReleasesDatasource.id;
    currentValue = path[4];
  } else if (
    path[2] === 'archive' &&
    path[3] === 'refs' &&
    path[4] === 'tags'
  ) {
    datasource = GithubTagsDatasource.id;
    currentValue = path[5];
  } else if (path[2] === 'archive') {
    datasource = GithubTagsDatasource.id;
    currentValue = path[3];
  }

  if (currentValue) {
    // Strip archive extension to get hash or tag.
    // Tolerates formats produced by Git(Hub|Lab) and allowed by http_archive
    // Note: Order matters in suffix list to strip, e.g. .tar.gz.
    for (const extension of ['.gz', '.bz2', '.xz', '.tar', '.tgz', '.zip']) {
      if (currentValue.endsWith(extension)) {
        currentValue = currentValue.slice(0, -extension.length);
      }
    }

    return { datasource, repo, currentValue };
  }
  return null;
}

export function httpDependency({
  rule: depType,
  name: depName,
  url,
  urls,
  sha256,
}: Target): PackageDependency | null {
  let dep: PackageDependency | null = null;

  if (
    (depType === 'http_archive' || depType === 'http_file') &&
    is.string(depName) &&
    is.string(sha256)
  ) {
    let parsedUrl: UrlParsedResult | null = null;
    if (is.string(url)) {
      parsedUrl = parseArchiveUrl(url);
    } else if (is.array(urls, is.string)) {
      for (const u of urls) {
        parsedUrl = parseArchiveUrl(u);
        if (parsedUrl) {
          break;
        }
      }
    }

    if (parsedUrl) {
      dep = {
        datasource: parsedUrl.datasource,
        depType,
        depName,
        packageName: parsedUrl.repo,
      };

      if (regEx(/^[a-f0-9]{40}$/i).test(parsedUrl.currentValue)) {
        dep.currentDigest = parsedUrl.currentValue;
      } else {
        dep.currentValue = parsedUrl.currentValue;
      }
    }
  }

  return dep;
}
