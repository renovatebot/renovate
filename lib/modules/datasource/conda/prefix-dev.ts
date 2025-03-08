import is from '@sindresorhus/is';
import { z } from 'zod';
import { logger } from '../../../logger';
import { isNotNullOrUndefined } from '../../../util/array';
import type { Http } from '../../../util/http';
import type { Timestamp } from '../../../util/timestamp';
import { MaybeTimestamp } from '../../../util/timestamp';
import type { ReleaseResult } from '../types';

const MAX_PREFIX_DEV_GRAPHQL_PAGE = 10;

const File = z.object({
  version: z.string(),
  createdAt: z.string().nullable(),
  yankedReason: z.string().nullable(),
});

const Version = z.object({
  version: z.string(),
});

const PagedResponseSchema = z.object({
  data: z.object({
    data: z.object({
      data: z
        .object({
          pages: z.number(),
          page: z.array(z.unknown()),
        })
        .nullable(),
    }),
  }),
});

export async function getReleases(
  http: Http,
  channel: string,
  packageName: string,
): Promise<ReleaseResult | null> {
  logger.debug(
    { channel, packageName },
    'lookup package from prefix.dev graphql API',
  );

  const versions = await getPagedResponse(
    http,
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
    Version,
  );

  if (versions.length === 0) {
    return null;
  }

  const files = await getPagedResponse(
    http,
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
    File,
  );

  const releaseDate: Record<string, Timestamp> = {};
  const yanked: Record<string, boolean> = {};

  for (const file of files) {
    yanked[file.version] = Boolean(
      isNotNullOrUndefined(file.yankedReason) || yanked[file.version],
    );

    const dt = MaybeTimestamp.parse(file.createdAt);
    if (is.nullOrUndefined(dt)) {
      continue;
    }

    const currentDt = releaseDate[file.version];
    if (is.nullOrUndefined(currentDt)) {
      releaseDate[file.version] = dt;
      continue;
    }

    if (currentDt.localeCompare(dt) < 0) {
      releaseDate[file.version] = dt;
    }
  }

  return {
    releases: versions.map(({ version }) => {
      return {
        version,
        releaseDate: releaseDate[version],
        isDeprecated: yanked[version],
      };
    }),
  };
}

async function getPagedResponse<T extends z.Schema>(
  http: Http,
  query: string,
  data: any,
  schema: T,
): Promise<z.infer<T>[]> {
  const result: unknown[] = [];

  for (let page = 0; page <= MAX_PREFIX_DEV_GRAPHQL_PAGE; page++) {
    const res = await http.postJson(
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
      PagedResponseSchema,
    );

    const currentPage = res.body.data.data?.data;
    if (!currentPage) {
      break;
    }

    result.push(...currentPage.page);

    if (page >= currentPage.pages - 1) {
      break;
    }
  }

  return z.array(schema).parse(result);
}
