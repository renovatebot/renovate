import { z } from 'zod';
import { Timestamp } from '../../../timestamp';
import type { GithubGraphqlDatasourceAdapter, GithubTagItem } from '../types';
import { prepareQuery } from '../util';

const key = 'github-tags-datasource-v2';

const GithubGraphqlTag = z.object({
  version: z.string(),
  target: z.union([
    z.object({
      type: z.literal('Commit'),
      oid: z.string(),
      releaseTimestamp: Timestamp,
    }),
    z.object({
      type: z.literal('Tag'),
      target: z.union([
        z.object({
          type: z.literal('Commit'),
          oid: z.string(),
        }),
        z.object({
          type: z.literal('Tag'),
          target: z.object({ oid: z.string() }),
        }),
      ]),
      tagger: z.object({
        releaseTimestamp: Timestamp,
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
            type: __typename
            ... on Commit {
              oid
            }
            ... on Tag {
              target {
                oid
              }
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
  if (target.type === 'Commit') {
    const releaseTimestamp = target.releaseTimestamp;
    const hash = target.oid;
    return { version, gitRef: version, hash, releaseTimestamp };
  }

  const releaseTimestamp = target.tagger.releaseTimestamp;
  if (target.target.type === 'Commit') {
    const hash = target.target.oid;
    return { version, gitRef: version, hash, releaseTimestamp };
  }

  const hash = target.target.target.oid;
  return { version, gitRef: version, hash, releaseTimestamp };
}

export const adapter: GithubGraphqlDatasourceAdapter<
  GithubGraphqlTag,
  GithubTagItem
> = { key, query, transform };
