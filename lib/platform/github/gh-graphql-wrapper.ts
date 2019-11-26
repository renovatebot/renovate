import { logger } from '../../logger';
import { GotJSONOptions } from '../../util/got';
import got from './gh-got-wrapper';

const gqlOpts: GotJSONOptions = {
  json: true,
  method: 'POST',
  headers: {
    accept: 'application/vnd.github.merge-info-preview+json',
  },
};

interface GithubGraphqlResponse<T = unknown> {
  data?: {
    repository?: T;
  };
  errors?: { message: string; locations: unknown }[];
}

async function gqlGet<T = unknown>(
  query: string
): Promise<GithubGraphqlResponse<T>> {
  try {
    const body = { query };
    const options: GotJSONOptions = { ...gqlOpts, body };
    const okToRetry = false;
    const res = await got('graphql', options, okToRetry);
    return res && res.body;
  } catch (err) {
    logger.warn({ query, err }, 'GraphQL request error');
    throw new Error('platform-failure');
  }
}

export async function getGraphqlNodes<T = Record<string, unknown>>(
  queryOrig: string,
  fieldName: string
): Promise<T[]> {
  const result: T[] = [];

  const regex = new RegExp(`(\\W)${fieldName}(\\s*)\\(`);

  let cursor = null;
  let count = 100;
  let canIterate = true;

  while (canIterate) {
    let replacement = `$1${fieldName}$2(first: ${count}`;
    if (cursor) replacement += `, after: "${cursor}", `;
    const query = queryOrig.replace(regex, replacement);
    const gqlRes = await gqlGet<T>(query);
    if (
      gqlRes &&
      gqlRes.data &&
      gqlRes.data.repository &&
      gqlRes.data.repository[fieldName]
    ) {
      const { nodes, pageInfo } = gqlRes.data.repository[fieldName];
      result.push(...nodes);

      const { hasNextPage, endCursor } = pageInfo;
      if (hasNextPage && endCursor) {
        cursor = endCursor;
      } else {
        canIterate = false;
      }
    } else {
      count = Math.floor(count / 2);
      if (count === 0) {
        logger.info('Error fetching GraphQL nodes');
        canIterate = false;
      }
    }
  }

  return result;
}
