import url from 'url';
import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../logger';
import { parse } from '../../util/html';
import { Http } from '../../util/http';
import { ensureTrailingSlash } from '../../util/url';
import * as pep440 from '../../versioning/pep440';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

export const id = 'pypi';
export const customRegistrySupport = true;
export const defaultRegistryUrls = [
  process.env.PIP_INDEX_URL || 'https://pypi.org/pypi/',
];
export const defaultVersioning = pep440.id;
export const registryStrategy = 'merge';
export const caching = true;

const githubRepoPattern = /^https?:\/\/github\.com\/[^\\/]+\/[^\\/]+$/;
const http = new Http(id);

type PypiJSONRelease = {
  requires_python?: string;
  upload_time?: string;
  yanked?: boolean;
};
type Releases = Record<string, PypiJSONRelease[]>;
type PypiJSON = {
  info: {
    name: string;
    home_page?: string;
    project_urls?: Record<string, string>;
  };

  releases?: Releases;
};

function normalizeName(input: string): string {
  return input.toLowerCase().replace(/(-|\.)/g, '_');
}

async function getDependency(
  packageName: string,
  hostUrl: string
): Promise<ReleaseResult | null> {
  const lookupUrl = url.resolve(hostUrl, `${packageName}/json`);
  const dependency: ReleaseResult = { releases: null };
  logger.trace({ lookupUrl }, 'Pypi api got lookup');
  const rep = await http.getJson<PypiJSON>(lookupUrl);
  const dep = rep?.body;
  if (!dep) {
    logger.trace({ dependency: packageName }, 'pip package not found');
    return null;
  }
  if (rep.authorization) {
    dependency.isPrivate = true;
  }
  logger.trace({ lookupUrl }, 'Got pypi api result');
  if (
    !(dep.info && normalizeName(dep.info.name) === normalizeName(packageName))
  ) {
    logger.warn(
      { lookupUrl, lookupName: packageName, returnedName: dep.info.name },
      'Returned name does not match with requested name'
    );
    return null;
  }

  if (dep.info?.home_page) {
    dependency.homepage = dep.info.home_page;
    if (githubRepoPattern.exec(dep.info.home_page)) {
      dependency.sourceUrl = dep.info.home_page.replace('http://', 'https://');
    }
  }

  if (dep.info?.project_urls) {
    for (const [name, projectUrl] of Object.entries(dep.info.project_urls)) {
      const lower = name.toLowerCase();

      if (
        !dependency.sourceUrl &&
        (lower.startsWith('repo') ||
          lower === 'code' ||
          lower === 'source' ||
          githubRepoPattern.exec(projectUrl))
      ) {
        dependency.sourceUrl = projectUrl;
      }

      if (
        !dependency.changelogUrl &&
        ([
          'changelog',
          'change log',
          'changes',
          'release notes',
          'news',
          "what's new",
        ].includes(lower) ||
          changelogFilenameRegex.exec(lower))
      ) {
        // from https://github.com/pypa/warehouse/blob/418c7511dc367fb410c71be139545d0134ccb0df/warehouse/templates/packaging/detail.html#L24
        dependency.changelogUrl = projectUrl;
      }
    }
  }

  dependency.releases = [];
  if (dep.releases) {
    const versions = Object.keys(dep.releases);
    dependency.releases = versions.map((version) => {
      const releases = dep.releases[version] || [];
      const { upload_time: releaseTimestamp } = releases[0] || {};
      const isDeprecated = releases.some(({ yanked }) => yanked);
      const result: Release = {
        version,
        releaseTimestamp,
      };
      if (isDeprecated) {
        result.isDeprecated = isDeprecated;
      }
      // There may be multiple releases with different requires_python, so we return all in an array
      result.constraints = {
        python: releases.map(({ requires_python }) => requires_python),
      };
      return result;
    });
  }
  return dependency;
}

function extractVersionFromLinkText(
  text: string,
  packageName: string
): string | null {
  const srcPrefixes = [`${packageName}-`, `${packageName.replace(/-/g, '_')}-`];
  for (const prefix of srcPrefixes) {
    const suffix = '.tar.gz';
    if (text.startsWith(prefix) && text.endsWith(suffix)) {
      return text.replace(prefix, '').replace(/\.tar\.gz$/, '');
    }
  }

  // pep-0427 wheel packages
  //  {distribution}-{version}(-{build tag})?-{python tag}-{abi tag}-{platform tag}.whl.
  const wheelPrefix = packageName.replace(/[^\w\d.]+/g, '_') + '-';
  const wheelSuffix = '.whl';
  if (
    text.startsWith(wheelPrefix) &&
    text.endsWith(wheelSuffix) &&
    text.split('-').length > 2
  ) {
    return text.split('-')[1];
  }

  return null;
}

function cleanSimpleHtml(html: string): string {
  return (
    html
      .replace(/<\/?pre>/, '')
      // Certain simple repositories like artifactory don't escape > and <
      .replace(
        /data-requires-python="([^"]*?)>([^"]*?)"/g,
        'data-requires-python="$1&gt;$2"'
      )
      .replace(
        /data-requires-python="([^"]*?)<([^"]*?)"/g,
        'data-requires-python="$1&lt;$2"'
      )
  );
}

async function getSimpleDependency(
  packageName: string,
  hostUrl: string
): Promise<ReleaseResult | null> {
  const lookupUrl = url.resolve(hostUrl, ensureTrailingSlash(packageName));
  const dependency: ReleaseResult = { releases: null };
  const response = await http.get(lookupUrl);
  const dep = response?.body;
  if (!dep) {
    logger.trace({ dependency: packageName }, 'pip package not found');
    return null;
  }
  if (response.authorization) {
    dependency.isPrivate = true;
  }
  const root = parse(cleanSimpleHtml(dep));
  const links = root.querySelectorAll('a');
  const releases: Releases = {};
  for (const link of Array.from(links)) {
    const version = extractVersionFromLinkText(link.text, packageName);
    if (version) {
      const release: PypiJSONRelease = {
        yanked: link.hasAttribute('data-yanked'),
      };
      const requiresPython = link.getAttribute('data-requires-python');
      if (requiresPython) {
        release.requires_python = requiresPython;
      }
      if (!releases[version]) {
        releases[version] = [];
      }
      releases[version].push(release);
    }
  }
  const versions = Object.keys(releases);
  dependency.releases = versions.map((version) => {
    const versionReleases = releases[version] || [];
    const isDeprecated = versionReleases.some(({ yanked }) => yanked);
    const result: Release = { version };
    if (isDeprecated) {
      result.isDeprecated = isDeprecated;
    }
    // There may be multiple releases with different requires_python, so we return all in an array
    result.constraints = {
      python: versionReleases.map(({ requires_python }) => requires_python),
    };
    return result;
  });
  return dependency;
}

export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  let dependency: ReleaseResult = null;
  const hostUrl = ensureTrailingSlash(registryUrl);

  // not all simple indexes use this identifier, but most do
  if (hostUrl.endsWith('/simple/') || hostUrl.endsWith('/+simple/')) {
    logger.trace({ lookupName, hostUrl }, 'Looking up pypi simple dependency');
    dependency = await getSimpleDependency(lookupName, hostUrl);
  } else {
    logger.trace({ lookupName, hostUrl }, 'Looking up pypi api dependency');
    try {
      // we need to resolve early here so we can catch any 404s and fallback to a simple lookup
      dependency = await getDependency(lookupName, hostUrl);
    } catch (err) {
      if (err.statusCode !== 404) {
        throw err;
      }

      // error contacting json-style api -- attempt to fallback to a simple-style api
      logger.trace(
        { lookupName, hostUrl },
        'Looking up pypi simple dependency via fallback'
      );
      dependency = await getSimpleDependency(lookupName, hostUrl);
    }
  }
  return dependency;
}
