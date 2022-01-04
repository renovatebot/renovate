import url from 'url';
import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../logger';
import { parse } from '../../util/html';
import { regEx } from '../../util/regex';
import { ensureTrailingSlash } from '../../util/url';
import * as pep440 from '../../versioning/pep440';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import type { PypiJSON, PypiJSONRelease, Releases } from './types';

const githubRepoPattern = regEx(/^https?:\/\/github\.com\/[^\\/]+\/[^\\/]+$/);

export class PypiDatasource extends Datasource {
  static readonly id = 'pypi';

  constructor() {
    super(PypiDatasource.id);
  }

  override readonly caching = true;

  override readonly customRegistrySupport = true;

  override readonly defaultRegistryUrls = [
    process.env.PIP_INDEX_URL || 'https://pypi.org/pypi/',
  ];

  override readonly defaultVersioning = pep440.id;

  override readonly registryStrategy = 'merge';

  async getReleases({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    let dependency: ReleaseResult = null;
    const hostUrl = ensureTrailingSlash(registryUrl);
    const normalizedLookupName = PypiDatasource.normalizeName(lookupName);

    // not all simple indexes use this identifier, but most do
    if (hostUrl.endsWith('/simple/') || hostUrl.endsWith('/+simple/')) {
      logger.trace(
        { lookupName, hostUrl },
        'Looking up pypi simple dependency'
      );
      dependency = await this.getSimpleDependency(
        normalizedLookupName,
        hostUrl
      );
    } else {
      logger.trace({ lookupName, hostUrl }, 'Looking up pypi api dependency');
      try {
        // we need to resolve early here so we can catch any 404s and fallback to a simple lookup
        dependency = await this.getDependency(normalizedLookupName, hostUrl);
      } catch (err) {
        if (err.statusCode !== 404) {
          throw err;
        }

        // error contacting json-style api -- attempt to fallback to a simple-style api
        logger.trace(
          { lookupName, hostUrl },
          'Looking up pypi simple dependency via fallback'
        );
        dependency = await this.getSimpleDependency(
          normalizedLookupName,
          hostUrl
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
    hostUrl: string
  ): Promise<ReleaseResult | null> {
    const lookupUrl = url.resolve(
      hostUrl,
      `${PypiDatasource.normalizeNameForUrlLookup(packageName)}/json`
    );
    const dependency: ReleaseResult = { releases: null };
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
      if (githubRepoPattern.exec(dep.info.home_page)) {
        dependency.sourceUrl = dep.info.home_page.replace(
          'http://',
          'https://'
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

  private static extractVersionFromLinkText(
    text: string,
    packageName: string
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
    const wheelText = text.toLowerCase();
    const wheelPrefix = packageName.replace(regEx(/[^\w\d.]+/g), '_') + '-';
    const wheelSuffix = '.whl';
    if (
      wheelText.startsWith(wheelPrefix) &&
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
          'data-requires-python="$1&gt;$2"'
        )
        .replace(
          regEx(/data-requires-python="([^"]*?)<([^"]*?)"/g),
          'data-requires-python="$1&lt;$2"'
        )
    );
  }

  private async getSimpleDependency(
    packageName: string,
    hostUrl: string
  ): Promise<ReleaseResult | null> {
    const lookupUrl = url.resolve(
      hostUrl,
      ensureTrailingSlash(PypiDatasource.normalizeNameForUrlLookup(packageName))
    );
    const dependency: ReleaseResult = { releases: null };
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
        packageName
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
}
