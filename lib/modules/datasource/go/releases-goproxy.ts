import {
  isNonEmptyString,
  isNonEmptyStringAndNotWhitespace,
  isTruthy,
} from '@sindresorhus/is';
import type { ConstraintsFilter } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { detectPlatform } from '../../../util/common.ts';
import { getEnv } from '../../../util/env.ts';
import { filterMap } from '../../../util/filter-map.ts';
import { queryReleases } from '../../../util/github/graphql/index.ts';
import { GithubHttp } from '../../../util/http/github.ts';
import { HttpError } from '../../../util/http/index.ts';
import * as p from '../../../util/promises.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import {
  joinUrlParts,
  parseUrl,
  trimLeadingSlash,
  trimTrailingSlash,
} from '../../../util/url.ts';
import goVersioning from '../../versioning/go-mod-directive/index.ts';
import { Datasource } from '../datasource.ts';
import { GithubReleasesDatasource } from '../github-releases/index.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { BaseGoDatasource } from './base.ts';
import { getSourceUrl } from './common.ts';
import { parseGoproxy, parseNoproxy } from './goproxy-parser.ts';
import { GoDirectDatasource } from './releases-direct.ts';
import { VersionInfo } from './schema.ts';

/** TODO #42566 */
const goVersionRegex = regEx(/^\s*go\s+(?<version>[^\s]+)\s*$/);

const modRegex = regEx(/^(?<baseMod>.*?)(?:[./]v(?<majorVersion>\d+))?$/);

const versionTagRegex = regEx(/^v\d/);

/**
 * Modules with a major version of v2 or above which have no `go.mod` are reported by a Go proxy with a `+incompatible` suffix, which is absent from the tag they were published as.
 *
 * @see https://go.dev/ref/mod#non-module-compat
 */
const incompatibleSuffixRegex = regEx(/\+incompatible$/);

/**
 * @see https://go.dev/ref/mod#pseudo-versions
 */
const pseudoVersionRegex = regEx(
  /v\d+\.\d+\.\d+-(?:\w+\.)?(?:0\.)?(?<timestamp>\d{14})-(?<digest>[a-f0-9]{12})/i,
);

export function pseudoVersionToRelease(pseudoVersion: string): Release | null {
  const match = pseudoVersion.match(pseudoVersionRegex)?.groups;
  if (!match) {
    return null;
  }

  const { digest: newDigest, timestamp } = match;
  const releaseTimestamp = asTimestamp(timestamp);

  return {
    version: pseudoVersion,
    newDigest,
    releaseTimestamp,
  };
}

/**
 * A Go module which lives in a subdirectory of its repository is tagged with that subdirectory as a prefix, so `github.com/aws/aws-sdk-go-v2/service/s3` publishes `v1.2.3` as the tag `service/s3/v1.2.3`.
 *
 * @see https://go.dev/ref/mod#vcs-version
 *
 * Because we can't tell from the module path alone where the repository ends and the subdirectory begins, we try each candidate prefix - longest first - against the tags we actually found, in the same way as `filterByPrefix` does for direct lookups.
 */
export function getTagPrefix(goModule: string, tags: Iterable<string>): string {
  const nameParts = goModule
    .replace(regEx(/\/v\d+$/), '')
    .split('/')
    .slice(1);
  const tagNames = [...tags];

  while (nameParts.length) {
    const prefix = `${nameParts.join('/')}/`;

    const isUsed = tagNames.some(
      (tag) =>
        tag.startsWith(prefix) &&
        versionTagRegex.test(tag.slice(prefix.length)),
    );
    if (isUsed) {
      return prefix;
    }

    nameParts.shift();
  }

  return '';
}

export class GoProxyDatasource extends Datasource {
  static readonly id = 'go-proxy';

  constructor() {
    super(GoProxyDatasource.id);
  }

  readonly direct = new GoDirectDatasource();

  private readonly githubHttp = new GithubHttp(GithubReleasesDatasource.id);

  private async _getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const { packageName } = config;
    logger.trace(`goproxy.getReleases(${packageName})`);
    const goproxy = getEnv().GOPROXY ?? 'https://proxy.golang.org,direct';
    if (goproxy === 'direct') {
      return this.direct.getReleases(config);
    }
    const proxyList = parseGoproxy(goproxy);
    const noproxy = parseNoproxy();

    let result: ReleaseResult | null = null;
    let servedByProxy = false;

    if (noproxy?.test(packageName)) {
      logger.debug(`Fetching ${packageName} via GONOPROXY match`);
      result = await this.direct.getReleases(config);
      return result;
    }

    for (const { url, fallback } of proxyList) {
      try {
        if (url === 'off') {
          break;
        } else if (url === 'direct') {
          result = await this.direct.getReleases(config);
          break;
        }

        const res = await this.getVersionsWithInfo(
          url,
          packageName,
          config.constraintsFiltering,
        );
        if (res.releases.length) {
          result = res;
          servedByProxy = true;
          break;
        }
      } catch (err) {
        const potentialHttpError =
          err instanceof ExternalHostError ? err.err : err;
        const statusCode = potentialHttpError?.response?.statusCode;
        const canFallback =
          fallback === '|' ? true : statusCode === 404 || statusCode === 410;
        const msg = canFallback
          ? 'Goproxy error: trying next URL provided with GOPROXY'
          : 'Goproxy error: skipping other URLs provided with GOPROXY';
        logger.debug({ err }, msg);
        if (!canFallback) {
          break;
        }
      }
    }

    if (result && !result.sourceUrl) {
      try {
        const datasource = await BaseGoDatasource.getDatasource(packageName);
        const sourceUrl = getSourceUrl(datasource);
        if (sourceUrl) {
          result.sourceUrl = sourceUrl;
        }
      } catch (err) {
        logger.trace({ err }, `Can't get datasource for ${packageName}`);
      }
    }

    if (result?.sourceUrl && servedByProxy) {
      await this.addGithubReleaseTimestamps(
        packageName,
        result.sourceUrl,
        result.releases,
      );
    }

    return result;
  }

  /**
   * A Go proxy reports the commit time of the tagged commit as a version's `Time`, which can be much earlier than the point at which that version was released.
   *
   * When the module is hosted on GitHub and the version has a GitHub Release, the Release's publication time is a better indicator of when the version became available.
   */
  async addGithubReleaseTimestamps(
    packageName: string,
    sourceUrl: string,
    releases: Release[],
  ): Promise<void> {
    if (detectPlatform(sourceUrl) !== 'github') {
      return;
    }

    const parsedUrl = parseUrl(sourceUrl);
    /* v8 ignore next -- detectPlatform only returns a platform for parseable URLs */
    if (!parsedUrl) {
      return;
    }

    const repository = trimTrailingSlash(
      trimLeadingSlash(parsedUrl.pathname),
    ).replace(regEx(/\.git$/), '');

    try {
      const githubReleases = await queryReleases(
        {
          packageName: repository,
          registryUrl: parsedUrl.origin,
        },
        this.githubHttp,
      );

      const timestamps = new Map<string, Timestamp>();
      for (const { version, releaseTimestamp } of githubReleases) {
        timestamps.set(version, releaseTimestamp);
      }

      const tagPrefix = getTagPrefix(packageName, timestamps.keys());
      for (const release of releases) {
        const version = release.version.replace(incompatibleSuffixRegex, '');
        const releaseTimestamp = timestamps.get(`${tagPrefix}${version}`);
        if (
          releaseTimestamp &&
          (!release.releaseTimestamp ||
            releaseTimestamp > release.releaseTimestamp)
        ) {
          release.releaseTimestamp = releaseTimestamp;
        }
      }
    } catch (err) {
      logger.debug(
        { err, packageName },
        'Error fetching GitHub Releases for Go module',
      );
    }
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${GoProxyDatasource.id}`,
        key: GoProxyDatasource.getCacheKey(config),
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  /**
   * Avoid ambiguity when serving from case-insensitive file systems.
   *
   * @see https://golang.org/ref/mod#goproxy-protocol
   */
  encodeCase(input: string): string {
    return input.replace(regEx(/([A-Z])/g), (x) => `!${x.toLowerCase()}`);
  }

  async listVersions(baseUrl: string, packageName: string): Promise<Release[]> {
    const url = joinUrlParts(
      baseUrl,
      this.encodeCase(packageName),
      '@v',
      'list',
    );
    const { body } = await this.http.getText(url);
    return filterMap(body.split(newlineRegex), (str) => {
      if (!isNonEmptyStringAndNotWhitespace(str)) {
        return null;
      }

      const [version, timestamp] = str.trim().split(regEx(/\s+/));
      const release: Release = pseudoVersionToRelease(version) ?? { version };

      const releaseTimestamp = asTimestamp(timestamp);
      if (releaseTimestamp) {
        release.releaseTimestamp = releaseTimestamp;
      }

      return release;
    });
  }

  async versionInfo(
    baseUrl: string,
    packageName: string,
    version: string,
  ): Promise<Release> {
    const url = joinUrlParts(
      baseUrl,
      this.encodeCase(packageName),
      '@v',
      `${version}.info`,
    );
    const res = await this.http.getJson(url, VersionInfo);

    const result: Release = {
      version: res.body.Version,
    };

    const releaseTimestamp = asTimestamp(res.body.Time);
    if (releaseTimestamp) {
      result.releaseTimestamp = releaseTimestamp;
    }

    return result;
  }

  /**
   * Retrieve the `go` directive for a given Go Module.
   *
   * NOTE that this means the `go` directive, not the `toolchain` directive.
   */
  async retrieveGoDirectiveForModule(
    baseUrl: string,
    packageName: string,
    version: string,
  ): Promise<string | undefined> {
    return withCache(
      {
        namespace: `datasource-${GoProxyDatasource.id}`,
        key: GoProxyDatasource.getVersionedCacheKey(packageName, version),
        // a module's `go.mod` should /never/ change after it's published. If going via the Go Proxy and the Go Checksum Database, a change in this value will result in build failures.
        ttlMinutes: 100 * 24 * 60,
      },
      () => this._retrieveGoDirectiveForModule(baseUrl, packageName, version),
    );
  }

  async _retrieveGoDirectiveForModule(
    baseUrl: string,
    packageName: string,
    version: string,
  ): Promise<string | undefined> {
    const url = joinUrlParts(
      baseUrl,
      this.encodeCase(packageName),
      '@v',
      `${version}.mod`,
    );
    const res = await this.http.getText(url);

    let goDirective: string | undefined = undefined;

    for (const line of res.body.split('\n')) {
      const goVersionMatches = goVersionRegex.exec(line)?.groups;
      if (goVersionMatches) {
        goDirective = goVersionMatches.version;
        break;
      }
    }

    if (!goDirective) {
      return goDirective;
    }

    // always return it in full SemVer format, which can then be matched on using `semver` or `semver-coerced`
    const parts = goDirective.split('.');
    if (parts.length === 1) {
      return `${parts[0]}.0.0`;
    }
    if (parts.length === 2) {
      return `${parts[0]}.${parts[1]}.0`;
    }
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }

  async getLatestVersion(
    baseUrl: string,
    packageName: string,
  ): Promise<{ version: string; sourceUrl?: string } | null> {
    try {
      const url = joinUrlParts(
        baseUrl,
        this.encodeCase(packageName),
        '@latest',
      );
      const res = await this.http.getJson(url, VersionInfo);
      const { Version: version, Origin: origin } = res.body;
      // Extract sourceUrl from GOPROXY Origin when present, avoiding go-get to
      // vanity hosts (https://github.com/renovatebot/renovate/discussions/44898)
      const sourceUrl =
        origin?.VCS === 'git' && isNonEmptyString(origin.URL)
          ? origin.URL.replace(regEx(/\.git$/), '')
          : undefined;
      return { version, sourceUrl };
    } catch (err) {
      logger.trace({ err }, 'Failed to get latest version');
      return null;
    }
  }

  async getVersionsWithInfo(
    baseUrl: string,
    packageName: string,
    constraintsFiltering: ConstraintsFilter | undefined,
  ): Promise<ReleaseResult> {
    const isGopkgin = packageName.startsWith('gopkg.in/');
    const majorSuffixSeparator = isGopkgin ? '.' : '/';
    const modParts = packageName.match(modRegex)?.groups;
    const baseMod =
      modParts?.baseMod ??
      /* v8 ignore next -- defensive: modRegex matches any non-empty package name, so baseMod is always set */ packageName;
    const packageMajor = parseInt(modParts?.majorVersion ?? '0', 10);

    const result: ReleaseResult = { releases: [] };
    for (let major = packageMajor; ; major += 1) {
      let pkg = `${baseMod}${majorSuffixSeparator}v${major}`;
      if (!isGopkgin && major < 2) {
        pkg = baseMod;
        major += 1; // v0 and v1 are the same module
      }

      let releases: Release[] = [];

      try {
        const res = await this.listVersions(baseUrl, pkg);

        // Artifactory returns all versions in any major (past and future),
        // so starting from v2, we filter them in order to avoid the infinite loop
        const filteredReleases = res.filter(({ version }) => {
          if (major < 2) {
            return true;
          }

          return (
            version.split(regEx(/[^\d]+/)).find(isTruthy) === major.toString()
          );
        });

        releases = await p.map(filteredReleases, async (versionInfo) => {
          const { version, newDigest, releaseTimestamp } = versionInfo;

          if (releaseTimestamp) {
            return { version, newDigest, releaseTimestamp };
          }

          try {
            return await this.versionInfo(baseUrl, pkg, version);
          } catch (err) {
            logger.trace({ err }, `Can't obtain data from ${baseUrl}`);
            return { version };
          }
        });

        if (constraintsFiltering === 'strict') {
          releases = await p.map(releases, async (rel) => {
            try {
              const goDirective = await this.retrieveGoDirectiveForModule(
                baseUrl,
                pkg,
                rel.version,
              );
              if (goDirective) {
                rel.constraints ??= {};
                rel.constraints['%goMod'] ??= [];
                rel.constraints['%goMod'].push(goDirective);
              }
            } catch (err) {
              logger.trace(
                { err },
                `Can't obtain \`go\` directive from ${baseUrl}`,
              );
            }

            return rel;
          });
        }

        result.releases.push(...releases);
      } catch (err) {
        const potentialHttpError =
          err instanceof ExternalHostError ? err.err : err;
        const status = potentialHttpError.response?.statusCode;
        if (
          potentialHttpError instanceof HttpError &&
          (status === 404 || status === 403) &&
          major !== packageMajor
        ) {
          break;
        }

        throw err;
      }

      const latest = await this.getLatestVersion(baseUrl, pkg);
      if (latest) {
        const { version: latestVersion, sourceUrl } = latest;
        result.tags ??= {};
        result.tags.latest ??= latestVersion;
        if (goVersioning.isGreaterThan(latestVersion, result.tags.latest)) {
          result.tags.latest = latestVersion;
        }
        if (sourceUrl) {
          result.sourceUrl ??= sourceUrl;
        }
        if (!result.releases.length) {
          const releaseFromLatest = pseudoVersionToRelease(latestVersion);
          if (releaseFromLatest) {
            result.releases.push(releaseFromLatest);
          }
        }
      }

      if (!releases.length) {
        break;
      }
    }

    return result;
  }

  static getCacheKey({
    packageName,
    constraintsFiltering,
  }: GetReleasesConfig): string {
    const goproxy = getEnv().GOPROXY;
    const noproxy = parseNoproxy();
    const constraintsFilteringKey =
      constraintsFiltering && constraintsFiltering !== 'none'
        ? `@@${constraintsFiltering}`
        : '';
    // TODO: types (#22198)
    return `${packageName}@@${goproxy}@@${noproxy?.toString()}${constraintsFilteringKey}`;
  }

  static getVersionedCacheKey(packageName: string, version: string): string {
    const goproxy = getEnv().GOPROXY;
    const noproxy = parseNoproxy();
    // TODO: types (#22198)
    return `${packageName}@@${version}@@${goproxy}@@${noproxy?.toString()}`;
  }
}
