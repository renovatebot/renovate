import { logger } from '../../logger';
import got, { GotJSONOptions } from '../../util/got';
import { getHostType, getBaseUrl, dispatchError } from './gh-got-wrapper';

const accept = 'application/vnd.github.merge-info-preview+json';

const gqlOpts: GotJSONOptions = {
  json: true,
  method: 'POST',
  headers: {
    accept,
  },
};

interface GithubGraphqlResponse<T = unknown> {
  data?: {
    repository?: T;
  };
  errors?: { message: string; locations: unknown }[];
}

async function get<T = unknown>(
  query: string
): Promise<GithubGraphqlResponse<T>> {
  let result = null;

  const path = 'graphql';
  const options: GotJSONOptions = {
    ...gqlOpts,
    hostType: getHostType(),
    baseUrl: (getBaseUrl() || '').replace('/v3/', '/'), // GitHub Enterprise uses unversioned graphql path
    body: { query },
  };

  if (global.appMode) {
    options.headers = {
      ...options.headers,
      accept: `application/vnd.github.machine-man-preview+json, ${accept}`,
      'user-agent':
        process.env.RENOVATE_USER_AGENT ||
        'https://github.com/renovatebot/renovate',
    };
  }

  logger.trace(`Performing Github GraphQL request`);

  try {
    const res = await got('graphql', options);
    result = res && res.body;
  } catch (gotErr) {
    dispatchError(gotErr, path, options);
  }
  return result;
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
    const gqlRes = await get<T>(query);
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
        logger.error('Error fetching GraphQL nodes');
        canIterate = false;
      }
    }
  }

  return result;
}
