import is from '@sindresorhus/is';
import { z } from 'zod';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import { ensureTrailingSlash, joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { datasource, defaultRegistryUrl } from './common';
import type { CondaPackage } from './types';
import { MaybeTimestamp, Timestamp } from '../../../util/timestamp';

const prefixDevPageLimit = 500;

const prefixDevQuery = `
query search($channel: String!, $package: String!, $page: Int = 0) {
  package(channelName: $channel, name: $package) {
    versions(limit: ${prefixDevPageLimit}, page: $page) {
      totalCount
      pages
      current
      page {
        version
      }
    }
  }
}
  `;

export class CondaDatasource extends Datasource {
  static readonly id = datasource;

  constructor() {
    super(datasource);
  }

  override readonly customRegistrySupport = true;

  override readonly registryStrategy = 'hunt';

  override readonly defaultRegistryUrls = [defaultRegistryUrl];

  override readonly caching = true;

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `dev_url` field in the results.';

  @cache({
    namespace: `datasource-${datasource}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#22198)
      `${registryUrl}:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.trace({ registryUrl, packageName }, 'fetching conda package');

    if (!registryUrl) {
      return null;
    }

    if (registryUrl.startsWith('https://prefix.dev/')) {
      const channel = ensureTrailingSlash(registryUrl).split('/').at(-2);
      /* v8 ignore next 8: manager extract conda packages with unexpected registryUrl */
      if (is.undefined(channel)) {
        logger.error(
          { registryUrl, packageName },
          'conda repo from prefix.dev missing channel info',
        );

        return null;
      }

      return await this.getReleasesFromPrefixDev(channel, packageName);
    }

    const url = joinUrlParts(registryUrl, packageName);

    const result: ReleaseResult = {
      releases: [],
    };

    const releaseDate: Map<string, Timestamp> = new Map();

    let response: { body: CondaPackage };

    try {
      response = await this.http.getJsonUnchecked(url);

      result.homepage = response.body.html_url;
      result.sourceUrl = response.body.dev_url;

      response.body.files.forEach((file) => {
        const dt = MaybeTimestamp.parse(file.upload_time);
        if (is.nullOrUndefined(dt)) {
          return;
        }

        const currentDt = releaseDate.get(file.version);
        if (is.nullOrUndefined(currentDt)) {
          releaseDate.set(file.version, dt);
          return;
        }

        if (currentDt.localeCompare(dt) < 0) {
          releaseDate.set(file.version, dt);
        }
      });

      response.body.versions.forEach((version: string) => {
        const thisRelease: Release = {
          version,
          releaseTimestamp: releaseDate.get(version),
        };
        result.releases.push(thisRelease);
      });
    } catch (err) {
      if (err instanceof HttpError) {
        if (err.response?.statusCode !== 404) {
          throw new ExternalHostError(err);
        }
      }
      this.handleGenericErrors(err);
    }

    return result.releases.length ? result : null;
  }

  private async getReleasesFromPrefixDev(
    channel: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    // TODO: get yanked version
    logger.debug(
      { channel, packageName },
      'lookup package from prefix.dev graphql API',
    );

    const result: ReleaseResult = {
      releases: [],
    };

    let page = 0;
    while (true) {
      logger.debug(
        { channel, packageName, page },
        'lookup package from prefix.dev graphql API',
      );

      const data = await this.http.postJson(
        'https://prefix.dev/api/graphql',
        {
          body: {
            operationName: 'search',
            query: prefixDevQuery,
            variables: {
              channel,
              package: packageName,
              page,
            },
          },
        },
        PrefixDevResponse,
      );

      page++;

      const res = data.body.data.package;
      if (!res) {
        return null;
      }

      result.releases.push(...res.versions.page);

      if (page >= res.versions.pages) {
        break;
      }
    }

    return result;
  }
}

const PrefixDevResponse = z.object({
  data: z.object({
    package: z
      .object({
        versions: z.object({
          totalCount: z.number(),
          pages: z.number(),
          page: z.array(z.object({ version: z.string() })),
        }),
      })
      .nullable(),
  }),
});
