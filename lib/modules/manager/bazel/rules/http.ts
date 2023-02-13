import is from '@sindresorhus/is';
import { z } from 'zod';
import { regEx } from '../../../../util/regex';
import { parseUrl } from '../../../../util/url';
import { GithubReleasesDatasource } from '../../../datasource/github-releases';
import { GithubTagsDatasource } from '../../../datasource/github-tags';
import type { PackageDependency } from '../../types';
import type { UrlParsedResult } from '../types';

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
  const [p0, p1, p2, p3, p4, p5] = url.pathname.split('/').slice(1);
  const repo = p0 + '/' + p1;
  let datasource = '';
  let currentValue: string | null = null;
  if (p2 === 'releases' && p3 === 'download') {
    // https://github.com/foo/bar/releases/download/1.2.3/bar-1.2.3.tar.gz
    datasource = GithubReleasesDatasource.id;
    currentValue = p4;
  } else if (p2 === 'archive' && p3 === 'refs' && p4 === 'tags') {
    // https://github.com/foo/bar/archive/refs/tags/v1.2.3.tar.gz
    datasource = GithubTagsDatasource.id;
    currentValue = p5;
  } else if (p2 === 'archive') {
    // https://github.com/foo/bar/archive/1.2.3.tar.gz
    datasource = GithubTagsDatasource.id;
    currentValue = p3;
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

export const httpRules = ['http_archive', 'http_file'] as const;

export const HttpTarget = z
  .object({
    rule: z.enum(httpRules),
    name: z.string(),
    url: z.string().optional(),
    urls: z.array(z.string()).optional(),
    sha256: z.string(),
  })
  .refine(({ url, urls }) => !!url || !!urls)
  .transform(({ rule, name, url, urls = [] }): PackageDependency[] => {
    const parsedUrl = [url, ...urls].map(parseArchiveUrl).find(is.truthy);
    if (!parsedUrl) {
      return [];
    }

    const dep: PackageDependency = {
      datasource: parsedUrl.datasource,
      depType: rule,
      depName: name,
      packageName: parsedUrl.repo,
    };

    if (regEx(/^[a-f0-9]{40}$/i).test(parsedUrl.currentValue)) {
      dep.currentDigest = parsedUrl.currentValue;
    } else {
      dep.currentValue = parsedUrl.currentValue;
    }

    return [dep];
  });
