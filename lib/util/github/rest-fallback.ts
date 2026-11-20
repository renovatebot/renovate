import { z } from 'zod/v4';
import { logger } from '../../logger/index.ts';
import * as memCache from '../cache/memory/index.ts';
import type { GithubHttp } from '../http/github.ts';
import { LooseArray } from '../schema-utils/index.ts';
import { Timestamp } from '../timestamp.ts';
import { isIpAllowListDenial } from './ip-allow-list.ts';
import type {
  GithubPackageConfig,
  GithubReleaseItem,
  GithubTagLookupItem,
} from './graphql/types.ts';
import { getApiBaseUrl } from './url.ts';

const RestTags = LooseArray(
  z.object({ name: z.string(), commit: z.object({ sha: z.string() }) }),
);

const RestReleases = LooseArray(
  z.object({
    tag_name: z.string(),
    published_at: Timestamp.nullable(),
    draft: z.boolean(),
    prerelease: z.boolean(),
    html_url: z.string(),
    id: z.number(),
    name: z.string().nullable(),
    body: z.string().nullable(),
  }),
);

/**
 * Without a token, because GitHub refused it.
 * The REST API of GitHub can be used without one for public repositories, unlike its GraphQL API.
 */
function getAnonymously<Schema extends z.ZodType>(
  http: GithubHttp,
  { packageName, registryUrl }: GithubPackageConfig,
  endpoint: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const url = `${getApiBaseUrl(registryUrl)}repos/${packageName}/${endpoint}?per_page=100`;
  return http
    .getJson(url, { noAuth: true, readOnly: true, paginate: true }, schema)
    .then(({ body }) => body);
}

/**
 * Tags as REST reports them, which do not tell when a tag was created.
 */
export async function fetchRestTags(
  http: GithubHttp,
  config: GithubPackageConfig,
): Promise<GithubTagLookupItem[]> {
  const tags = await getAnonymously(http, config, 'tags', RestTags);
  return tags.map(({ name, commit }) => ({
    version: name,
    gitRef: name,
    hash: commit.sha,
  }));
}

/**
 * Releases as REST reports them, without drafts.
 */
export async function fetchRestReleases(
  http: GithubHttp,
  config: GithubPackageConfig,
): Promise<GithubReleaseItem[]> {
  const releases = await getAnonymously(http, config, 'releases', RestReleases);
  const items: GithubReleaseItem[] = [];
  for (const release of releases) {
    if (release.draft || !release.published_at) {
      continue;
    }
    const item: GithubReleaseItem = {
      version: release.tag_name,
      releaseTimestamp: release.published_at,
      url: release.html_url,
      id: release.id,
    };
    if (release.name) {
      item.name = release.name;
    }
    if (release.body) {
      item.description = release.body;
    }
    if (release.prerelease) {
      item.isStable = false;
    }
    items.push(item);
  }
  return items;
}

/**
 * Key of the owners whose organization refused the token during this repository run.
 */
function ipAllowListKey({
  packageName,
  registryUrl,
}: GithubPackageConfig): string {
  const [owner] = packageName.split('/');
  return `github-ip-allow-list:${getApiBaseUrl(registryUrl)}${owner}`;
}

/**
 * Looks up with `graphql`, and with `rest` if an IP allow list refused the token, because the GraphQL API can't be used without one.
 *
 * Once an organization refused the token, `rest` is used first for its other repositories, which saves a GraphQL request which would be refused.
 * If `rest` fails too, for example because the unauthenticated rate limit is exhausted, the GraphQL error is thrown.
 */
export async function withIpAllowListFallback<T>(
  config: GithubPackageConfig,
  graphql: () => Promise<T>,
  rest: () => Promise<T>,
): Promise<T> {
  const { packageName, registryUrl } = config;
  const key = ipAllowListKey(config);
  let restFailed = false;

  if (memCache.get<boolean>(key)) {
    try {
      return await rest();
    } catch (err) {
      restFailed = true;
      logger.debug(
        { err, packageName },
        'GitHub REST API without a token failed, using the GraphQL API',
      );
    }
  }

  try {
    return await graphql();
  } catch (err) {
    if (restFailed || !isIpAllowListDenial(err)) {
      throw err;
    }
    memCache.set(key, true);
    logger.debug(
      { packageName, registryUrl },
      'GitHub refused the token because of an IP allow list, using the REST API without a token',
    );
    try {
      return await rest();
    } catch (restErr) {
      logger.debug(
        { err: restErr, packageName },
        'GitHub REST API without a token failed, using the original error',
      );
      throw err;
    }
  }
}
