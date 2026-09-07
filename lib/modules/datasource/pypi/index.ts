import { isNonEmptyString } from '@sindresorhus/is';
import changelogFilenameRegex from 'changelog-filename-regex';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { coerceArray, deduplicateArray } from '../../../util/array.ts';
import { getEnv } from '../../../util/env.ts';
import { parse } from '../../../util/html.ts';
import { HttpError } from '../../../util/http/index.ts';
import type {
  HttpResponse,
  OutgoingHttpHeaders,
} from '../../../util/http/types.ts';
import { regEx } from '../../../util/regex.ts';
import { Json } from '../../../util/schema-utils/index.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { ensureTrailingSlash, parseUrl } from '../../../util/url.ts';
import * as pep440 from '../../versioning/pep440/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { getGoogleAuthToken } from '../util.ts';
import { isGitHubRepo, normalizePythonDepName } from './common.ts';
import type { PypiRelease } from './schema.ts';
import { PypiResponse, PypiSimpleResponse } from './schema.ts';
import type { Releases } from './types.ts';

export class PypiDatasource extends Datasource {
  static readonly id = 'pypi';

  constructor() {
    super(PypiDatasource.id);
  }

  override readonly caching = true;

  override readonly customRegistrySupport = true;

  static readonly defaultURL =
    getEnv().PIP_INDEX_URL ?? 'https://pypi.org/pypi/';
  override readonly defaultRegistryUrls = [PypiDatasource.defaultURL];

  override readonly defaultVersioning = pep440.id;

  override readonly registryStrategy = 'merge';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the earliest `upload_time` field of the files of a version. When using the Simple API, timestamps are available if the server supports the JSON-based Simple API (PEP 691).';
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

  private sanitizeLookupUrl(lookupUrl: string, parsedUrl: URL): string {
    if (!parsedUrl.username && !parsedUrl.password) {
      return lookupUrl;
    }

    parsedUrl.username = '';
    parsedUrl.password = '';
    return parsedUrl.toString();
  }

  private async getAuthHeaders(
    lookupUrl: string,
  ): Promise<{ headers: OutgoingHttpHeaders; lookupUrl: string }> {
    const parsedUrl = parseUrl(lookupUrl);
    // v8 ignore if -- TODO: refactor to cover this branch through public behavior again
    if (!parsedUrl) {
      logger.once.debug({ lookupUrl }, 'Failed to parse URL');
      return { headers: {}, lookupUrl };
    }
    if (parsedUrl.hostname.endsWith('.pkg.dev')) {
      const auth = await getGoogleAuthToken();
      if (auth) {
        const sanitizedLookupUrl = this.sanitizeLookupUrl(lookupUrl, parsedUrl);
        return {
          headers: { authorization: `Basic ${auth}` },
          lookupUrl: sanitizedLookupUrl,
        };
      }
      logger.once.debug({ lookupUrl }, 'Could not get Google access token');
      return { headers: {}, lookupUrl };
    }
    return { headers: {}, lookupUrl };
  }

  private async getDependency(
    packageName: string,
    hostUrl: string,
  ): Promise<ReleaseResult | null> {
    const lookupUrl = new URL(
      `${normalizePythonDepName(packageName)}/json`,
      hostUrl,
    ).href;
    const dependency: ReleaseResult = { releases: [] };
    logger.trace({ lookupUrl }, 'Pypi api got lookup');
    const { headers, lookupUrl: sanitizedUrl } =
      await this.getAuthHeaders(lookupUrl);
    const rep = await this.http.getJson(
      sanitizedUrl,
      { headers },
      PypiResponse,
    );
    const dep = rep?.body;
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
          projectUrl &&
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
      dependency.releases = PypiDatasource.toReleases(dep.releases);
    }
    return dependency;
  }

  private static getEarliestTimestamp(
    releases: PypiRelease[],
  ): Timestamp | null {
    let earliest: Timestamp | null = null;
    for (const { upload_time } of releases) {
      const timestamp = asTimestamp(upload_time);
      // `asTimestamp` normalizes to UTC ISO 8601, so comparing the strings compares the instants
      if (timestamp && (!earliest || timestamp < earliest)) {
        earliest = timestamp;
      }
    }
    return earliest;
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
          regEx(/data-requires-python="(?<before>[^"]*?)>(?<after>[^"]*?)"/g),
          'data-requires-python="$<before>&gt;$<after>"',
        )
        .replace(
          regEx(/data-requires-python="(?<before>[^"]*?)<(?<after>[^"]*?)"/g),
          'data-requires-python="$<before>&lt;$<after>"',
        )
    );
  }

  private static getSimpleReleasesFromHtml(
    html: string,
    packageName: string,
  ): Releases {
    const root = parse(PypiDatasource.cleanSimpleHtml(html));
    const links = root.querySelectorAll('a');
    const releases: Releases = {};
    for (const link of Array.from(links)) {
      const version = PypiDatasource.extractVersionFromLinkText(
        link.text?.trim(),
        packageName,
      );
      if (version) {
        const release: PypiRelease = {
          yanked: link.hasAttribute('data-yanked'),
        };
        const requiresPython = link.getAttribute('data-requires-python');
        if (requiresPython) {
          release.requires_python = requiresPython;
        }
        (releases[version] ??= []).push(release);
      }
    }
    return releases;
  }

  private static getSimpleReleasesFromJson(
    json: string,
    packageName: string,
  ): Releases | null {
    const releases: Releases = {};
    const parsed = Json.pipe(PypiSimpleResponse).safeParse(json);
    if (!parsed.success) {
      logger.once.warn(
        { packageName, err: parsed.error },
        'Failed to parse JSON-based Simple API response',
      );
      // Distinguish a malformed response from a package with genuinely no files, so the caller doesn't mistake an error for an empty result.
      return null;
    }
    for (const file of parsed.data.files) {
      const version = PypiDatasource.extractVersionFromLinkText(
        file.filename,
        packageName,
      );
      if (version) {
        (releases[version] ??= []).push(file);
      }
    }
    return releases;
  }

  private async getSimpleDependency(
    packageName: string,
    hostUrl: string,
  ): Promise<ReleaseResult | null> {
    const lookupUrl = new URL(
      ensureTrailingSlash(normalizePythonDepName(packageName)),
      hostUrl,
    ).href;
    const dependency: ReleaseResult = { releases: [] };
    const { headers: authHeaders, lookupUrl: sanitizedUrl } =
      await this.getAuthHeaders(lookupUrl);
    const headers: OutgoingHttpHeaders = {
      ...authHeaders,
      // Request the JSON serialization (PEP 691), falling back to the legacy HTML serialization (PEP 503) via content negotiation.
      // https://github.com/pypa/pip/blob/6b0011b49a068c62f65389bf4cea7af5d28cb002/src/pip/_internal/index/collector.py#L128-L134
      accept:
        'application/vnd.pypi.simple.v1+json, application/vnd.pypi.simple.v1+html; q=0.1, text/html; q=0.01',
    };
    let response: HttpResponse;
    try {
      response = await this.http.getText(sanitizedUrl, { headers });
    } catch (err) {
      // An `abortOnError` host rule makes `Http` wrap the original error, so unwrap it before looking at the status code.
      const httpErr = err instanceof ExternalHostError ? err.err : err;
      const statusCode =
        httpErr instanceof HttpError ? httpErr.response?.statusCode : undefined;
      // A registry which cannot serve any of the negotiated types may pick a content type of its own, answer `406`, or answer `300`; the spec mandates none of them, but `406` is the common choice.
      // https://packaging.python.org/en/latest/specifications/simple-repository-api/#version-format-selection
      // Retry once without the negotiated `accept` header to preserve the pre-PEP-691 behaviour of a plain request.
      if (statusCode !== 406) {
        throw err;
      }

      logger.trace(
        { packageName, hostUrl, statusCode },
        'Registry rejected negotiated Accept header, retrying without it',
      );
      response = await this.http.getText(sanitizedUrl, {
        headers: authHeaders,
      });
    }
    const dep = response?.body;
    if (!dep) {
      logger.trace({ dependency: packageName }, 'pip package not found');
      return null;
    }
    if (response.authorization) {
      dependency.isPrivate = true;
    }

    // Dispatch on the response content-type: JSON serialization (PEP 691) or the legacy HTML serialization (PEP 503). Matched loosely (any `json` media type) rather than the exact vendor type, as some registries/proxies relabel or strip the vendor-specific media type while still returning JSON.
    const contentType = response.headers['content-type'];
    const isJson = !!contentType && contentType.includes('json');
    const looksLikeJson = dep.trimStart().startsWith('{');

    if (isJson) {
      if (looksLikeJson) {
        const releases = PypiDatasource.getSimpleReleasesFromJson(
          dep,
          packageName,
        );
        // A parse failure is distinct from a package with genuinely no files, so don't report an empty release list as if it were a real (if empty) result, which would be cached as such.
        if (!releases) {
          return null;
        }
        dependency.releases = PypiDatasource.toReleases(releases);
        return dependency;
      }

      // The registry mislabeled a non-JSON body as JSON, so fall through to the HTML parser instead of reporting the package as not found.
      logger.debug(
        { packageName, hostUrl, contentType },
        'Parsing Simple API response as HTML, as it is labeled as JSON but does not look like it',
      );
    }

    const htmlReleases = PypiDatasource.getSimpleReleasesFromHtml(
      dep,
      packageName,
    );
    dependency.releases = PypiDatasource.toReleases(htmlReleases);
    if (dependency.releases.length > 0 || !looksLikeJson) {
      return dependency;
    }

    // The registry honored the `Accept` header but omitted or mislabeled the `content-type`, so a JSON body went through the HTML parser and found nothing. Parse it as JSON instead of silently reporting no releases.
    logger.debug(
      { packageName, hostUrl, contentType },
      'Retrying Simple API response as JSON, as it is not labeled as JSON but looks like it',
    );
    const jsonReleases = PypiDatasource.getSimpleReleasesFromJson(
      dep,
      packageName,
    );
    if (!jsonReleases) {
      return null;
    }
    dependency.releases = PypiDatasource.toReleases(jsonReleases);
    return dependency;
  }

  /**
   * The files of a version are not ordered by upload time, so use the earliest one: that is when the version was first published, which is what `minimumReleaseAge` needs.
   */
  private static toReleases(releases: Releases): Release[] {
    const versions = Object.keys(releases);
    return versions.map((version) => {
      const versionReleases = coerceArray(releases[version]);
      const isDeprecated = versionReleases.some(({ yanked }) => yanked);
      const result: Release = { version };
      const releaseTimestamp =
        PypiDatasource.getEarliestTimestamp(versionReleases);
      if (releaseTimestamp) {
        result.releaseTimestamp = releaseTimestamp;
      }
      if (isDeprecated) {
        result.isDeprecated = isDeprecated;
      }
      const pythonConstraints = versionReleases.map(
        ({ requires_python }) => requires_python,
      );
      // A file without `requires_python` can be installed on any Python version, so the version as a whole is unconstrained
      const isUnconstrained = pythonConstraints.some(
        (constraint) => !isNonEmptyString(constraint),
      );
      // There may be multiple releases with different requires_python, so we return all in an array.
      // Report no constraints at all for an unconstrained version, instead of only those of its other files, which would drop the version under `constraintsFiltering=strict`.
      result.constraints = {
        python: isUnconstrained
          ? []
          : deduplicateArray(pythonConstraints.filter(isNonEmptyString)),
      };
      return result;
    });
  }
}
