import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import { filterMap } from '../../../util/filter-map';
import { HttpError } from '../../../util/http';
import * as p from '../../../util/promises';
import { newlineRegex, regEx } from '../../../util/regex';
import { asTimestamp } from '../../../util/timestamp';
import { joinUrlParts } from '../../../util/url';
import goVersioning from '../../versioning/go-mod-directive';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { BaseGoDatasource } from './base';
import { getSourceUrl } from './common';
import { parseGoproxy, parseNoproxy } from './goproxy-parser';
import { GoDirectDatasource } from './releases-direct';
import type { VersionInfo } from './types';

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

  @cache({
    namespace: `datasource-${GoProxyDatasource.id}`,
    key: (config: GetReleasesConfig) => GoProxyDatasource.getCacheKey(config),
  })
  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const { packageName } = config;
    logger.trace(`goproxy.getReleases(${packageName})`);
    const goproxy = process.env.GOPROXY ?? 'https://proxy.golang.org,direct';
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
      if (!is.nonEmptyStringAndNotWhitespace(str)) {
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
    const baseMod = modParts?.baseMod ?? /* istanbul ignore next */ packageName;
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
            version.split(regEx(/[^\d]+/)).find(is.truthy) === major.toString()
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
        if (
          potentialHttpError instanceof HttpError &&
          potentialHttpError.response?.statusCode === 404 &&
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
    const goproxy = process.env.GOPROXY;
    const noproxy = parseNoproxy();
    // TODO: types (#22198)
    return `${packageName}@@${goproxy}@@${noproxy?.toString()}`;
  }
}
