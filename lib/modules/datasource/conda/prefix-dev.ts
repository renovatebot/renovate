import { logger } from '../../../logger';
import { isNotNullOrUndefined } from '../../../util/array';
import type { Http } from '../../../util/http';
import { MaybeTimestamp } from '../../../util/timestamp';
import type { Release, ReleaseResult } from '../types';
import { type File, PagedResponseSchema } from './schema/prefix-dev';

const MAX_PREFIX_DEV_GRAPHQL_PAGE = 100;

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

  if (!files.length) {
    return null;
  }

  let homepage: string | undefined = undefined;
  let sourceUrl: string | undefined = undefined;

  const releases: Record<string, Release> = {};
  for (const file of files) {
    const version = file.version;

    homepage ??= file.urls.HOME;
    sourceUrl ??= file.urls.DEV;

    releases[version] ??= { version };

    // we assume all packages are roughly released on the same time
    releases[version].releaseTimestamp =
      releases[version].releaseTimestamp ??
      MaybeTimestamp.parse(file.createdAt);

    // if the version has not been marked as deprecated, check other releases packages of the same version
    releases[version].isDeprecated ??= isNotNullOrUndefined(file.yankedReason);
  }

  return {
    homepage,
    sourceUrl,
    releases: Object.values(releases),
  };
}

async function getPagedResponse(
  http: Http,
  query: string,
  data: any,
): Promise<File[]> {
  const result: File[] = [];

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
