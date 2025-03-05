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
      `3:${registryUrl}:${packageName}`,
  })
  async getReleases({
    registryUrl,
    packageName,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.debug({ registryUrl, packageName }, 'fetching conda package');

    if (!registryUrl) {
      return null;
    }

    if (registryUrl.startsWith('https://prefix.dev/')) {
      const channel = ensureTrailingSlash(registryUrl).split('/').at(-2);
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

    let response: { body: CondaPackage };

    try {
      response = await this.http.getJsonUnchecked(url);

      result.homepage = response.body.html_url;
      result.sourceUrl = response.body.dev_url;

      response.body.versions.forEach((version: string) => {
        const thisRelease: Release = {
          version,
        };
        result.releases.push(thisRelease);
      });
    } catch (err) {
      /* v8 ignore next 5: not testable with nock*/
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

      if (res.versions.page.length < prefixDevPageLimit) {
        break;
      }

      if (result.releases.length >= res.versions.totalCount) {
        break;
      }

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
