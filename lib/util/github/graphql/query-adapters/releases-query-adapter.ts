import { z } from 'zod';
import type {
  GithubGraphqlDatasourceAdapter,
  GithubReleaseItem,
} from '../types';
import { prepareQuery } from '../util';

const key = 'github-releases-datasource-v2';

const query = prepareQuery(`
  releases(
    first: $count
    after: $cursor
    orderBy: {field: CREATED_AT, direction: DESC}
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      version: tagName
      releaseTimestamp: publishedAt
      isDraft
      isPrerelease
      url
      id: databaseId
      name
      description
    }
  }
`);

const GithubGraphqlRelease = z.object({
  version: z.string(),
  releaseTimestamp: z.string(),
  isDraft: z.boolean(),
  isPrerelease: z.boolean(),
  url: z.string(),
  id: z.number().nullable(),
  name: z.string().nullable(),
  description: z.string().nullable(),
});
export type GithubGraphqlRelease = z.infer<typeof GithubGraphqlRelease>;

function transform(item: GithubGraphqlRelease): GithubReleaseItem | null {
  const releaseItem = GithubGraphqlRelease.safeParse(item);
  if (!releaseItem.success) {
    return null;
  }

  const {
    version,
    releaseTimestamp,
    isDraft,
    isPrerelease,
    url,
    id,
    name,
    description,
  } = releaseItem.data;

  if (isDraft) {
    return null;
  }

  const result: GithubReleaseItem = {
    version,
    releaseTimestamp,
    url,
  };

  if (id) {
    result.id = id;
  }

  if (name) {
    result.name = name;
  }

  if (description) {
    result.description = description;
  }

  if (isPrerelease) {
    result.isStable = false;
  }

  return result;
}

export const adapter: GithubGraphqlDatasourceAdapter<
  GithubGraphqlRelease,
  GithubReleaseItem
> = { key, query, transform };
