import is from '@sindresorhus/is';
import { z } from 'zod';
import { logger } from '../../../logger';
import { isNotNullOrUndefined } from '../../../util/array';
import type { Http } from '../../../util/http';
import type { Timestamp } from '../../../util/timestamp';
import { MaybeTimestamp } from '../../../util/timestamp';
import type { ReleaseResult } from '../types';

const MAX_PREFIX_DEV_GRAPHQL_PAGE = 100;

const File = z.object({
  version: z.string(),
  createdAt: z.string().nullable(),
  yankedReason: z.string().nullable(),
  urls: z
    .array(z.object({ url: z.string(), kind: z.string() }))
    .optional()
    .default([])
    .transform((urls) => {
      return Object.fromEntries(urls.map((url) => [url.kind, url.url]));
    }),
});

const query = `
query search($channel: String!, $package: String!, $page: Int = 0) {
  package(channelName: $channel, name: $package) {
    variants(limit: 500, page: $page) {
      pages
      page {
        createdAt
        version
        yankedReason
        urls {
          url
          kind
        }
      }
    }
  }
}
`;

const PagedResponseSchema = z.object({
  data: z.object({
    package: z.object({
      variants: z
        .object({
          pages: z.number(),
          page: z.array(File),
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

  const files = await getPagedResponse(http, query, {
    channel,
    package: packageName,
  });

  const releaseDate: Record<string, Timestamp> = {};
  const yanked: Record<string, boolean> = {};
  const versions = new Set<string>();

  let homepage: string | undefined = undefined;
  let sourceUrl: string | undefined = undefined;

  for (const file of files) {
    versions.add(file.version);
    yanked[file.version] = Boolean(
      isNotNullOrUndefined(file.yankedReason) || yanked[file.version],
    );

    homepage = homepage ?? file.urls.HOME;
    sourceUrl = sourceUrl ?? file.urls.DEV;

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

  if (!versions.size) {
    return null;
  }

  return {
    homepage,
    sourceUrl,
    releases: Array.from(versions).map((version) => {
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
): Promise<z.infer<typeof File>[]> {
  const result: z.infer<typeof File>[] = [];

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

    const currentPage = res.body.data.package?.variants;
    if (!currentPage) {
      break;
    }

    result.push(...currentPage.page);

    if (page >= currentPage.pages - 1) {
      break;
    }
  }

  return result;
}
