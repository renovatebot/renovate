import { z } from 'zod';
import type { GithubGraphqlDatasourceAdapter, GithubTagItem } from '../types';
import { prepareQuery } from '../util';

const key = 'github-tags-datasource-v2';

const GithubGraphqlTag = z.object({
  version: z.string(),
  target: z.union([
    z.object({
      type: z.literal('Commit'),
      oid: z.string(),
      releaseTimestamp: z.string(),
    }),
    z.object({
      type: z.literal('Tag'),
      target: z.object({
        oid: z.string(),
      }),
      tagger: z.object({
        releaseTimestamp: z.string(),
      }),
    }),
  ]),
});
export type GithubGraphqlTag = z.infer<typeof GithubGraphqlTag>;

const query = prepareQuery(`
  refs(
    first: $count
    after: $cursor
    orderBy: {field: TAG_COMMIT_DATE, direction: DESC}
    refPrefix: "refs/tags/"
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
        ... on Tag {
          target {
            ... on Commit {
              oid
            }
          }
          tagger {
            releaseTimestamp: date
          }
        }
      }
    }
  }`);

function transform(item: GithubGraphqlTag): GithubTagItem | null {
  const res = GithubGraphqlTag.safeParse(item);
  if (!res.success) {
    return null;
  }
  const { version, target } = item;
  const releaseTimestamp =
    target.type === 'Commit'
      ? target.releaseTimestamp
      : target.tagger.releaseTimestamp;
  const hash = target.type === 'Commit' ? target.oid : target.target.oid;
  return { version, gitRef: version, hash, releaseTimestamp };
}

export const adapter: GithubGraphqlDatasourceAdapter<
  GithubGraphqlTag,
  GithubTagItem
> = { key, query, transform };
