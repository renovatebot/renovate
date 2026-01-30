import { isNonEmptyStringAndNotWhitespace, isTruthy } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { getEnv } from '../../../util/env.ts';
import { filterMap } from '../../../util/filter-map.ts';
import { HttpError } from '../../../util/http/index.ts';
import * as p from '../../../util/promises.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts } from '../../../util/url.ts';
import goVersioning from '../../versioning/go-mod-directive/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { BaseGoDatasource } from './base.ts';
import { getSourceUrl } from './common.ts';
import { parseGoproxy, parseNoproxy } from './goproxy-parser.ts';
import { GoDirectDatasource } from './releases-direct.ts';
import type { VersionInfo } from './types.ts';

const modRegex = regEx(/^(?<baseMod>.*?)(?:[./]v(?<majorVersion>\d+))?$/);

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

export class GoProxyDatasource extends Datasource {
  static readonly id = 'go-proxy';

  constructor() {
    super(GoProxyDatasource.id);
  }

  readonly direct = new GoDirectDatasource();

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

        const res = await this.getVersionsWithInfo(url, packageName);
        if (res.releases.length) {
          result = res;
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

    return result;
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
    const res = await this.http.getJsonUnchecked<VersionInfo>(url);

    const result: Release = {
      version: res.body.Version,
    };

    const releaseTimestamp = asTimestamp(res.body.Time);
    if (releaseTimestamp) {
      result.releaseTimestamp = releaseTimestamp;
    }

    return result;
  }

  async getLatestVersion(
    baseUrl: string,
    packageName: string,
  ): Promise<string | null> {
    try {
      const url = joinUrlParts(
        baseUrl,
        this.encodeCase(packageName),
        '@latest',
      );
      const res = await this.http.getJsonUnchecked<VersionInfo>(url);
      return res.body.Version;
    } catch (err) {
      logger.trace({ err }, 'Failed to get latest version');
      return null;
    }
  }

  async getVersionsWithInfo(
    baseUrl: string,
    packageName: string,
  ): Promise<ReleaseResult> {
    const isGopkgin = packageName.startsWith('gopkg.in/');
    const majorSuffixSeparator = isGopkgin ? '.' : '/';
    const modParts = packageName.match(modRegex)?.groups;
    const baseMod = modParts?.baseMod ?? /* v8 ignore next */ packageName;
    const packageMajor = parseInt(modParts?.majorVersion ?? '0');

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

      const latestVersion = await this.getLatestVersion(baseUrl, pkg);
      if (latestVersion) {
        result.tags ??= {};
        result.tags.latest ??= latestVersion;
        if (goVersioning.isGreaterThan(latestVersion, result.tags.latest)) {
          result.tags.latest = latestVersion;
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

  static getCacheKey({ packageName }: GetReleasesConfig): string {
    const goproxy = getEnv().GOPROXY;
    const noproxy = parseNoproxy();
    // TODO: types (#22198)
    return `${packageName}@@${goproxy}@@${noproxy?.toString()}`;
  }
}
