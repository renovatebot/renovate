import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import moo from 'moo';
import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import * as p from '../../../util/promises';
import { newlineRegex, regEx } from '../../../util/regex';
import goVersioning from '../../versioning/go-mod-directive';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { BaseGoDatasource } from './base';
import { getSourceUrl } from './common';
import { GoDirectDatasource } from './releases-direct';
import type { GoproxyItem, VersionInfo } from './types';

const parsedGoproxy: Record<string, GoproxyItem[]> = {};

const modRegex = regEx(/^(?<baseMod>.*?)(?:[./]v(?<majorVersion>\d+))?$/);

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
    const proxyList = this.parseGoproxy(goproxy);
    const noproxy = GoProxyDatasource.parseNoproxy();

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
        if (res.tags?.latest) {
          result = res;
        }
      } catch (err) {
        const statusCode = err?.response?.statusCode;
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
   * Parse `GOPROXY` to the sequence of url + fallback strategy tags.
   *
   * @example
   * parseGoproxy('foo.example.com|bar.example.com,baz.example.com')
   * // [
   * //   { url: 'foo.example.com', fallback: '|' },
   * //   { url: 'bar.example.com', fallback: ',' },
   * //   { url: 'baz.example.com', fallback: '|' },
   * // ]
   *
   * @see https://golang.org/ref/mod#goproxy-protocol
   */
  parseGoproxy(input: string | undefined = process.env.GOPROXY): GoproxyItem[] {
    if (!is.string(input)) {
      return [];
    }

    if (parsedGoproxy[input]) {
      return parsedGoproxy[input];
    }

    const result: GoproxyItem[] = input
      .split(regEx(/([^,|]*(?:,|\|))/))
      .filter(Boolean)
      .map((s) => s.split(/(?=,|\|)/)) // TODO: #12872 lookahead
      .map(([url, separator]) => ({
        url,
        fallback: separator === ',' ? ',' : '|',
      }));

    parsedGoproxy[input] = result;
    return result;
  }
  // https://golang.org/pkg/path/#Match
  static lexer = moo.states({
    main: {
      separator: {
        match: /\s*?,\s*?/, // TODO #12870
        value: (_: string) => '|',
      },
      asterisk: {
        match: '*',
        value: (_: string) => '[^/]*',
      },
      qmark: {
        match: '?',
        value: (_: string) => '[^/]',
      },
      characterRangeOpen: {
        match: '[',
        push: 'characterRange',
        value: (_: string) => '[',
      },
      trailingSlash: {
        match: /\/$/,
        value: (_: string) => '',
      },
      char: {
        match: /[^*?\\[\n]/,
        value: (s: string) => s.replace(regEx('\\.', 'g'), '\\.'),
      },
      escapedChar: {
        match: /\\./, // TODO #12870
        value: (s: string) => s.slice(1),
      },
    },
    characterRange: {
      char: /[^\\\]\n]/, // TODO #12870
      escapedChar: {
        match: /\\./, // TODO #12870
        value: (s: string) => s.slice(1),
      },
      characterRangeEnd: {
        match: ']',
        pop: 1,
      },
    },
  });

  static parsedNoproxy: Record<string, RegExp | null> = {};

  static parseNoproxy(
    input: unknown = process.env.GONOPROXY ?? process.env.GOPRIVATE,
  ): RegExp | null {
    if (!is.string(input)) {
      return null;
    }
    if (this.parsedNoproxy[input] !== undefined) {
      return this.parsedNoproxy[input];
    }
    this.lexer.reset(input);
    const noproxyPattern = [...this.lexer].map(({ value }) => value).join('');
    const result = noproxyPattern
      ? regEx(`^(?:${noproxyPattern})(?:/.*)?$`)
      : null;
    this.parsedNoproxy[input] = result;
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
    const url = `${baseUrl}/${this.encodeCase(packageName)}/@v/list`;
    const { body } = await this.http.get(url);
    return body
      .split(newlineRegex)
      .filter(is.nonEmptyStringAndNotWhitespace)
      .map((str) => {
        const [version, releaseTimestamp] = str.split(regEx(/\s+/));
        return DateTime.fromISO(releaseTimestamp).isValid
          ? { version, releaseTimestamp }
          : { version };
      });
  }

  async versionInfo(
    baseUrl: string,
    packageName: string,
    version: string,
  ): Promise<Release> {
    const url = `${baseUrl}/${this.encodeCase(packageName)}/@v/${version}.info`;
    const res = await this.http.getJson<VersionInfo>(url);

    const result: Release = {
      version: res.body.Version,
    };

    if (res.body.Time) {
      result.releaseTimestamp = res.body.Time;
    }

    return result;
  }

  async getLatestVersion(
    baseUrl: string,
    packageName: string,
  ): Promise<string | null> {
    try {
      const url = `${baseUrl}/${this.encodeCase(packageName)}/@latest`;
      const res = await this.http.getJson<VersionInfo>(url);
      return res.body.Version;
    } catch (err) {
      logger.debug({ err }, 'Failed to get latest version');
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

      try {
        const res = await this.listVersions(baseUrl, pkg);
        const releases = await p.map(res, async (versionInfo) => {
          const { version, releaseTimestamp } = versionInfo;

          if (releaseTimestamp) {
            return { version, releaseTimestamp };
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
        if (
          err instanceof HttpError &&
          err.response?.statusCode === 404 &&
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
      }
    }

    return result;
  }

  static getCacheKey({ packageName }: GetReleasesConfig): string {
    const goproxy = process.env.GOPROXY;
    const noproxy = GoProxyDatasource.parseNoproxy();
    // TODO: types (#22198)
    return `${packageName}@@${goproxy}@@${noproxy?.toString()}`;
  }
}
