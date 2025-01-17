import url from 'node:url';
import is from '@sindresorhus/is';
import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { parse } from '../../../util/html';
import type { OutgoingHttpHeaders } from '../../../util/http/types';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash, parseUrl } from '../../../util/url';
import * as pep440 from '../../versioning/pep440';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { getGoogleAuthToken } from '../util';
import { isGitHubRepo, normalizePythonDepName } from './common';
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

  override readonly releaseTimestampNote =
    'The relase timestamp is determined from the `upload_time` field in the results.';
  override readonly sourceUrlSupport = 'release';
  override readonly sourceUrlNote =
    'The source URL is determined from the `homepage` field if it is a github repository, else we use the `project_urls` field.';

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    let dependency: ReleaseResult | null = null;
    // TODO: null check (#22198)
    const hostUrl = ensureTrailingSlash(
      registryUrl!.replace('https://pypi.org/simple', 'https://pypi.org/pypi'),
    );
    const normalizedLookupName = normalizePythonDepName(packageName);

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
        // error contacting json-style api -- attempt to fallback to a simple-style api
        logger.trace(
          { packageName, hostUrl, err },
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

  private async getAuthHeaders(
    lookupUrl: string,
  ): Promise<OutgoingHttpHeaders> {
    const parsedUrl = parseUrl(lookupUrl);
    if (!parsedUrl) {
      logger.once.debug({ lookupUrl }, 'Failed to parse URL');
      return {};
    }
    if (parsedUrl.hostname.endsWith('.pkg.dev')) {
      const auth = await getGoogleAuthToken();
      if (auth) {
        return { authorization: `Basic ${auth}` };
      }
      logger.once.debug({ lookupUrl }, 'Could not get Google access token');
      return {};
    }
    return {};
  }

  private async getDependency(
    packageName: string,
    hostUrl: string,
  ): Promise<ReleaseResult | null> {
    const lookupUrl = url.resolve(
      hostUrl,
      `${normalizePythonDepName(packageName)}/json`,
    );
    const dependency: ReleaseResult = { releases: [] };
    logger.trace({ lookupUrl }, 'Pypi api got lookup');
    const headers = await this.getAuthHeaders(lookupUrl);
    const rep = await this.http.getJsonUnchecked<PypiJSON>(lookupUrl, {
      headers,
    });
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
        const pythonConstraints = releases
          .map(({ requires_python }) => requires_python)
          .filter(is.string);
        result.constraints = {
          python: Array.from(new Set(pythonConstraints)),
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
    const lcText = text.toLowerCase();
    const normalizedSrcText = normalizePythonDepName(text);
    const srcPrefix = `${packageName}-`;

    // source distribution format: `{name}-{version}.tar.gz` (https://packaging.python.org/en/latest/specifications/source-distribution-format/#source-distribution-file-name)
    // binary distribution: `{distribution}-{version}(-{build tag})?-{python tag}-{abi tag}-{platform tag}.whl` (https://packaging.python.org/en/latest/specifications/binary-distribution-format/#file-name-convention)
    // officially both `name` and `distribution` should be normalized and then the - replaced with _, but in reality this is not the case
    // We therefore normalize the name we have (replacing `_-.` with -) and then check if the text starts with the normalized name

    if (!normalizedSrcText.startsWith(srcPrefix)) {
      return null;
    }

    // strip off the prefix using the prefix length as we may have normalized the srcPrefix/packageName
    // We assume that neither the version nor the suffix contains multiple `-` like `0.1.2---rc1.tar.gz`
    // and use the difference in length to strip off the prefix in case the name contains double `--` characters
    const normalizedLengthDiff = lcText.length - normalizedSrcText.length;
    const res = lcText.slice(srcPrefix.length + normalizedLengthDiff);

    // source distribution
    const srcSuffixes = ['.tar.gz', '.tar.bz2', '.tar.xz', '.zip', '.tgz'];
    const srcSuffix = srcSuffixes.find((suffix) => lcText.endsWith(suffix));
    if (srcSuffix) {
      // strip off the suffix using character length
      return res.slice(0, -srcSuffix.length);
    }

    // binary distribution
    // for binary distributions the version is the first part after the removed distribution name
    const wheelSuffix = '.whl';
    if (lcText.endsWith(wheelSuffix) && lcText.split('-').length > 2) {
      return res.split('-')[0];
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
      ensureTrailingSlash(normalizePythonDepName(packageName)),
    );
    const dependency: ReleaseResult = { releases: [] };
    const headers = await this.getAuthHeaders(lookupUrl);
    const response = await this.http.get(lookupUrl, { headers });
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
        link.text?.trim(),
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
