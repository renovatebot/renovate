import is from '@sindresorhus/is';
import { z } from 'zod';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { isNotNullOrUndefined } from '../../../util/array';
import { cache } from '../../../util/cache/package/decorator';
import { HttpError } from '../../../util/http';
import type { Timestamp } from '../../../util/timestamp';
import { MaybeTimestamp } from '../../../util/timestamp';
import { ensureTrailingSlash, joinUrlParts } from '../../../util/url';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { datasource, defaultRegistryUrl } from './common';
import type { CondaPackage } from './types';

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
      // the registryUrl here will at least contains 3 `/` ,
      // therefore channel won't be undefined in any case.
      const channel = ensureTrailingSlash(registryUrl)
        .split('/')
        .at(-2) as string;

      return await this.getReleasesFromPrefixDev(channel, packageName);
    }

    const url = joinUrlParts(registryUrl, packageName);

    const result: ReleaseResult = {
      releases: [],
    };

    const releaseDate = new Map<string, Timestamp>();

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
    logger.debug(
      { channel, packageName },
      'lookup package from prefix.dev graphql API',
    );

    const versions = await this.getPrefixPagedResponse(
      `
  query search($channel: String!, $package: String!, $page: Int = 0) {
    data: package(channelName: $channel, name: $package) {
      data: versions(limit: 500, page: $page) {
        pages
        page {
          version
        }
      }
    }
  }
  `,
      { channel, package: packageName },
      z.object({ version: z.string() }),
    );

    const files = await this.getPrefixPagedResponse(
      `
  query search($channel: String!, $package: String!, $page: Int = 0) {
    data: package(channelName: $channel, name: $package) {
      data: variants(limit: 500, page: $page) {
        pages
        page {
          version
          createdAt
          yankedReason
        }
      }
    }
  }
  `,
      { channel, package: packageName },
      z.object({
        version: z.string(),
        createdAt: z.string().nullable(),
        yankedReason: z.string().nullable(),
      }),
    );

    const releaseDate = new Map<string, Timestamp>();
    const yanked = new Map<string, boolean>();

    files.forEach((file) => {
      yanked.set(
        file.version,
        Boolean(
          isNotNullOrUndefined(file.yankedReason) || yanked.get(file.version),
        ),
      );

      const dt = MaybeTimestamp.parse(file.createdAt);
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

    return {
      releases: versions.map(({ version }) => {
        return {
          version,
          releaseDate: releaseDate.get(version),
          isDeprecated: yanked.get(version),
        };
      }),
    };
  }

  private async getPrefixPagedResponse<T extends z.Schema>(
    query: string,
    data: any,
    responseItem: T,
  ): Promise<z.infer<T>[]> {
    const scheme = z.object({
      data: z.object({
        data: z.object({
          data: z
            .object({
              pages: z.number(),
              page: z.array(responseItem),
            })
            .nullable(),
        }),
      }),
    });
    const result: z.infer<T>[] = [];

    let page = 0;
    while (true) {
      const res = await this.http.postJson(
        'https://prefix.dev/api/graphql',
        {
          body: {
            operationName: 'search',
            query,
            variables: {
              ...data,
              page,
            },
          },
        },
        scheme,
      );

      page++;

      const currentPage = res.body.data.data.data;
      if (!currentPage) {
        return result;
      }

      result.push(...currentPage.page);

      if (page >= currentPage.pages) {
        break;
      }
    }

    return result;
  }
}
