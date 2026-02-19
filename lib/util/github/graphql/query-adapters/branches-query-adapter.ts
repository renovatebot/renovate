import { z } from 'zod/v3';
import { Timestamp } from '../../../timestamp.ts';
import type {
  GithubBranchItem,
  GithubGraphqlDatasourceAdapter,
} from '../types.ts';
import { prepareQuery } from '../util.ts';

const key = 'github-branches-datasource-v1';

const GithubGraphqlBranch = z.object({
  version: z.string(),
  target: z.object({
    type: z.literal('Commit'),
    oid: z.string(),
    releaseTimestamp: Timestamp,
  }),
});
export type GithubGraphqlBranch = z.infer<typeof GithubGraphqlBranch>;

const query = prepareQuery(`
  refs(
    first: $count
    after: $cursor
    refPrefix: "refs/heads/"
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      version: name
      target {
        type: __typename
        ... on Commit {
          oid
          releaseTimestamp: committedDate
        }
      }
    }
  }`);

function transform(item: GithubGraphqlBranch): GithubBranchItem | null {
  const res = GithubGraphqlBranch.safeParse(item);
  if (!res.success) {
    return null;
  }

  const { version, target } = item;
  const releaseTimestamp = target.releaseTimestamp;
  const hash = target.oid;
  return { version, gitRef: version, hash, releaseTimestamp };
}

export const adapter: GithubGraphqlDatasourceAdapter<
  GithubGraphqlBranch,
  GithubBranchItem
> = { key, query, transform, maxItems: 300 };
