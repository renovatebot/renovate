import url from 'node:url';
import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { parse } from '../../../util/html';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash } from '../../../util/url';
import * as pep440 from '../../versioning/pep440';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { isGitHubRepo } from './common';
import type { PypiJSON, PypiJSONRelease, Releases } from './types';

export class PypiDatasource extends Datasource {
  static readonly id = 'pypi';

  constructor() {
    super(PypiDatasource.id);
  }

  override readonly caching = true;

  override readonly customRegistrySupport = true;

  static readonly defaultURL =
    process.env.PIP_INDEX_URL ?? 'https://pypi.org/pypi/';
  override readonly defaultRegistryUrls = [PypiDatasource.defaultURL];

  override readonly defaultVersioning = pep440.id;

  override readonly registryStrategy = 'merge';

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    let dependency: ReleaseResult | null = null;
    // TODO: null check (#22198)
    const hostUrl = ensureTrailingSlash(
      registryUrl!.replace('https://pypi.org/simple', 'https://pypi.org/pypi'),
    );
    const normalizedLookupName = PypiDatasource.normalizeName(packageName);

    // not all simple indexes use this identifier, but most do
    if (hostUrl.endsWith('/simple/') || hostUrl.endsWith('/+simple/')) {
      logger.trace(
        { packageName, hostUrl },
        'Looking up pypi simple dependency',
      );
      dependency = await this.getSimpleDependency(
        normalizedLookupName,
        hostUrl,
      );
    } else {
      logger.trace({ packageName, hostUrl }, 'Looking up pypi api dependency');
      try {
        // we need to resolve early here so we can catch any 404s and fallback to a simple lookup
        dependency = await this.getDependency(normalizedLookupName, hostUrl);
      } catch (err) {
        if (err.statusCode !== 404) {
          throw err;
        }

        // error contacting json-style api -- attempt to fallback to a simple-style api
        logger.trace(
          { packageName, hostUrl },
          'Looking up pypi simple dependency via fallback',
        );
        dependency = await this.getSimpleDependency(
          normalizedLookupName,
          hostUrl,
        );
      }
    }
    return dependency;
  }

  private static normalizeName(input: string): string {
    return input.toLowerCase().replace(regEx(/_/g), '-');
  }

  private static normalizeNameForUrlLookup(input: string): string {
    return input.toLowerCase().replace(regEx(/(_|\.|-)+/g), '-');
  }

  private async getDependency(
    packageName: string,
    hostUrl: string,
  ): Promise<ReleaseResult | null> {
    const lookupUrl = url.resolve(
      hostUrl,
      `${PypiDatasource.normalizeNameForUrlLookup(packageName)}/json`,
    );
    const dependency: ReleaseResult = { releases: [] };
    logger.trace({ lookupUrl }, 'Pypi api got lookup');
    const rep = await this.http.getJson<PypiJSON>(lookupUrl);
    const dep = rep?.body;
    if (!dep) {
      logger.trace({ dependency: packageName }, 'pip package not found');
      return null;
    }
    if (rep.authorization) {
      dependency.isPrivate = true;
    }
    logger.trace({ lookupUrl }, 'Got pypi api result');

    if (dep.info?.home_page) {
      dependency.homepage = dep.info.home_page;
      if (isGitHubRepo(dep.info.home_page)) {
        dependency.sourceUrl = dep.info.home_page.replace(
          'http://',
          'https://',
        );
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
            isGitHubRepo(projectUrl))
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

    if (dep.releases) {
      const versions = Object.keys(dep.releases);
      dependency.releases = versions.map((version) => {
        const releases = coerceArray(dep.releases?.[version]);
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
          // TODO: string[] isn't allowed here
          python: releases.map(({ requires_python }) => requires_python) as any,
        };
        return result;
      });
    }
    return dependency;
  }

  private static extractVersionFromLinkText(
    text: string,
    packageName: string,
  ): string | null {
    // source packages
    const srcText = PypiDatasource.normalizeName(text);
    const srcPrefix = `${packageName}-`;
    const srcSuffix = '.tar.gz';
    if (srcText.startsWith(srcPrefix) && srcText.endsWith(srcSuffix)) {
      return srcText.replace(srcPrefix, '').replace(regEx(/\.tar\.gz$/), '');
    }

    // pep-0427 wheel packages
    //  {distribution}-{version}(-{build tag})?-{python tag}-{abi tag}-{platform tag}.whl.
    // Also match the current wheel spec
    // https://packaging.python.org/en/latest/specifications/binary-distribution-format/#escaping-and-unicode
    // where any of -_. characters in {distribution} are replaced with _
    const wheelText = text.toLowerCase();
    const wheelPrefixWithPeriod =
      packageName.replace(regEx(/[^\w\d.]+/g), '_') + '-';
    const wheelPrefixWithoutPeriod =
      packageName.replace(regEx(/[^\w\d]+/g), '_') + '-';
    const wheelSuffix = '.whl';
    if (
      (wheelText.startsWith(wheelPrefixWithPeriod) ||
        wheelText.startsWith(wheelPrefixWithoutPeriod)) &&
      wheelText.endsWith(wheelSuffix) &&
      wheelText.split('-').length > 2
    ) {
      return wheelText.split('-')[1];
    }

    return null;
  }

  private static cleanSimpleHtml(html: string): string {
    return (
      html
        .replace(regEx(/<\/?pre>/), '')
        // Certain simple repositories like artifactory don't escape > and <
        .replace(
          regEx(/data-requires-python="([^"]*?)>([^"]*?)"/g),
          'data-requires-python="$1&gt;$2"',
        )
        .replace(
          regEx(/data-requires-python="([^"]*?)<([^"]*?)"/g),
          'data-requires-python="$1&lt;$2"',
        )
    );
  }

  private async getSimpleDependency(
    packageName: string,
    hostUrl: string,
  ): Promise<ReleaseResult | null> {
    const lookupUrl = url.resolve(
      hostUrl,
      ensureTrailingSlash(
        PypiDatasource.normalizeNameForUrlLookup(packageName),
      ),
    );
    const dependency: ReleaseResult = { releases: [] };
    const response = await this.http.get(lookupUrl);
    const dep = response?.body;
    if (!dep) {
      logger.trace({ dependency: packageName }, 'pip package not found');
      return null;
    }
    if (response.authorization) {
      dependency.isPrivate = true;
    }
    const root = parse(PypiDatasource.cleanSimpleHtml(dep));
    const links = root.querySelectorAll('a');
    const releases: Releases = {};
    for (const link of Array.from(links)) {
      const version = PypiDatasource.extractVersionFromLinkText(
        link.text,
        packageName,
      );
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
      const versionReleases = coerceArray(releases[version]);
      const isDeprecated = versionReleases.some(({ yanked }) => yanked);
      const result: Release = { version };
      if (isDeprecated) {
        result.isDeprecated = isDeprecated;
      }
      // There may be multiple releases with different requires_python, so we return all in an array
      result.constraints = {
        // TODO: string[] isn't allowed here
        python: versionReleases.map(
          ({ requires_python }) => requires_python,
        ) as any,
      };
      return result;
    });
    return dependency;
  }
}
