import is from '@sindresorhus/is';
import { z } from 'zod';
import { escapeRegExp, regEx } from '../../../../util/regex';
import { parseUrl } from '../../../../util/url';
import { GithubReleasesDatasource } from '../../../datasource/github-releases';
import { GithubTagsDatasource } from '../../../datasource/github-tags';
import type { PackageDependency } from '../../types';

const archives = [
  '.zip',
  '.tar',
  '.jar',
  '.war',
  '.aar',
  '.ar',
  '.deb',

  '.gz',
  '.tar.gz',
  '.tgz',

  '.bz2',
  '.tar.bz2',
  '.tbz2',

  '.xz',
  '.tar.xz',
  '.txz',

  '.zst',
  '.tar.zst',
  '.tzst',
];

const archiveSuffixRegex = regEx(
  `(?:${archives.map(escapeRegExp).join('|')})$`
);

function stripArchiveSuffix(value: string): string {
  return value.replace(archiveSuffixRegex, '');
}

function isHash(value: unknown): value is string {
  return is.string(value) && regEx(/[0-9a-z]{40}/i).test(value);
}

export function parseGithubPath(
  pathname: string
): Partial<PackageDependency> | null {
  const [p0, p1, p2, p3, p4, p5] = pathname.split('/').slice(1);
  const packageName = p0 + '/' + p1;
  let datasource = '';
  let value: string | null = null;
  if (p2 === 'releases' && p3 === 'download') {
    // https://github.com/foo/bar/releases/download/1.2.3/bar-1.2.3.tar.gz
    datasource = GithubReleasesDatasource.id;
    value = p4;
  } else if (p2 === 'archive' && p3 === 'refs' && p4 === 'tags') {
    // https://github.com/foo/bar/archive/refs/tags/v1.2.3.tar.gz
    datasource = GithubTagsDatasource.id;
    value = p5;
  } else if (p2 === 'archive') {
    // https://github.com/foo/bar/archive/1.2.3.tar.gz
    datasource = GithubTagsDatasource.id;
    value = p3;
  }

  if (!value) {
    return null;
  }

  value = stripArchiveSuffix(value);
  return isHash(value)
    ? { datasource, packageName, currentDigest: value }
    : { datasource, packageName, currentValue: value };
}

export function parseArchiveUrl(
  urlString: string | undefined | null
): Partial<PackageDependency> | null {
  if (!urlString) {
    return null;
  }

  const url = parseUrl(urlString);

  if (url?.host === 'github.com') {
    return parseGithubPath(url.pathname);
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
      packageName: parsedUrl.packageName,
    };

    // We don't want to set both `currentValue` and `currentDigest`,
    // relying on artifact updates instead.
    //
    // However, we want to auto-replace to be run successfully
    // against digest-only dependencies.
    //
    // Hence, `if-else-if` is being used here.
    if (parsedUrl.currentValue) {
      dep.currentValue = parsedUrl.currentValue;
    } else if (parsedUrl.currentDigest) {
      dep.currentDigest = parsedUrl.currentDigest;
    }

    return [dep];
  });
