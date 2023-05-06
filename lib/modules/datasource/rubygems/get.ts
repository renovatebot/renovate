import { Marshal } from '@qnighy/marshal';
import is from '@sindresorhus/is';
import { z } from 'zod';
import { logger } from '../../../logger';
import { HttpError } from '../../../util/http';
import { LooseArray } from '../../../util/schema-utils';
import { getQueryString, joinUrlParts, parseUrl } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';

const MarshalledVersionInfo = LooseArray(
  z
    .object({
      number: z.string(),
    })
    .transform(({ number: version }) => ({ version }))
)
  .transform((releases) => (releases.length === 0 ? null : { releases }))
  .nullable()
  .catch(null);

const GemsInfo = z
  .object({
    name: z.string().transform((x) => x.toLowerCase()),
    version: z.string().nullish().catch(null),
    changelog_uri: z.string().nullish().catch(null),
    homepage_uri: z.string().nullish().catch(null),
    source_code_uri: z.string().nullish().catch(null),
  })
  .transform(
    ({
      name: packageName,
      version,
      changelog_uri: changelogUrl,
      homepage_uri: homepage,
      source_code_uri: sourceUrl,
    }) => ({
      packageName,
      version,
      changelogUrl,
      homepage,
      sourceUrl,
    })
  );
type GemsInfo = z.infer<typeof GemsInfo>;

const GemVersions = LooseArray(
  z
    .object({
      number: z.string(),
      created_at: z.string(),
      platform: z.string().nullable().catch(null),
      ruby_version: z.string().nullable().catch(null),
      rubygems_version: z.string().nullable().catch(null),
    })
    .transform(
      ({
        number: version,
        created_at: releaseTimestamp,
        platform,
        ruby_version: rubyVersion,
        rubygems_version: rubygemsVersion,
      }): Release => {
        const result: Release = { version, releaseTimestamp };
        const constraints: Record<string, string[]> = {};

        if (platform) {
          constraints.platform = [platform];
        }

        if (rubyVersion) {
          constraints.ruby = [rubyVersion];
        }

        if (rubygemsVersion) {
          constraints.rubygems = [rubygemsVersion];
        }

        if (!is.emptyObject(constraints)) {
          result.constraints = constraints;
        }

        return result;
      }
    )
);
type GemVersions = z.infer<typeof GemVersions>;

export class InternalRubyGemsDatasource extends Datasource {
  constructor(override readonly id: string) {
    super(id);
  }

  async getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const registryUrl = config.registryUrl;
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const packageName = config.packageName.toLowerCase();

    const hostname = parseUrl(registryUrl)?.hostname;
    return hostname === 'rubygems.pkg.github.com' || hostname === 'gitlab.com'
      ? await this.getDependencyFallback(registryUrl, packageName)
      : await this.getDependency(registryUrl, packageName);
  }

  async getDependencyFallback(
    registryUrl: string,
    packageName: string
  ): Promise<ReleaseResult | null> {
    const path = joinUrlParts(registryUrl, `/api/v1/dependencies`);
    const query = getQueryString({ gems: packageName });
    const url = `${path}?${query}`;
    const { body: buffer } = await this.http.getBuffer(url);
    const data = Marshal.parse(buffer);
    return MarshalledVersionInfo.parse(data);
  }

  async fetchGemsInfo(
    registryUrl: string,
    packageName: string
  ): Promise<GemsInfo | null> {
    try {
      const { body } = await this.http.getJson(
        joinUrlParts(registryUrl, '/api/v1/gems', `${packageName}.json`),
        GemsInfo
      );
      return body;
    } catch (err) {
      // fallback to deps api on 404
      if (err instanceof HttpError && err.response?.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async fetchGemVersions(
    registryUrl: string,
    packageName: string
  ): Promise<GemVersions | null> {
    try {
      const { body } = await this.http.getJson(
        joinUrlParts(registryUrl, '/api/v1/versions', `${packageName}.json`),
        GemVersions
      );
      return body;
    } catch (err) {
      if (err.statusCode === 400 || err.statusCode === 404) {
        logger.debug(
          { registry: registryUrl },
          'versions endpoint returns error - falling back to info endpoint'
        );
        return null;
      } else {
        throw err;
      }
    }
  }

  async getDependency(
    registryUrl: string,
    packageName: string
  ): Promise<ReleaseResult | null> {
    const info = await this.fetchGemsInfo(registryUrl, packageName);
    if (!info) {
      return await this.getDependencyFallback(registryUrl, packageName);
    }

    if (info.packageName !== packageName) {
      logger.warn(
        { lookup: packageName, returned: info.packageName },
        'Lookup name does not match the returned name.'
      );
      return null;
    }

    let releases: Release[] | null = null;
    const gemVersions = await this.fetchGemVersions(registryUrl, packageName);
    if (gemVersions?.length) {
      releases = gemVersions;
    } else if (info.version) {
      releases = [{ version: info.version }];
    }

    if (!releases) {
      return null;
    }

    const result: ReleaseResult = { releases };

    if (info.changelogUrl) {
      result.changelogUrl = info.changelogUrl;
    }

    if (info.homepage) {
      result.homepage = info.homepage;
    }

    if (info.sourceUrl) {
      result.sourceUrl = info.sourceUrl;
    }

    return result;
  }
}
