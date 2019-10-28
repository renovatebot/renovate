import { api } from './gh-got-wrapper';
import { logger } from '../../logger';

const gqlOpts = {
  headers: {
    accept: 'application/vnd.github.merge-info-preview+json',
  },
  json: false,
};

interface GithubGraphqlResponse {
  data?: {
    repository?: any;
  };
  errors?: any;
}

async function gqlGet(query: string): Promise<GithubGraphqlResponse> {
  try {
    const body = JSON.stringify({ query });
    const options = { ...gqlOpts, body };
    const res = await api.post('graphql', options);
    return JSON.parse(res.body);
  } catch (err) {
    logger.warn({ query, err }, 'graphql.get error');
    throw new Error('platform-error');
  }
}

export async function getGraphqlNodes(
  queryOrig: string,
  fieldName: string
): Promise<any[]> {
  const result = [];

  const regex = new RegExp(`(\\W)${fieldName}(\\s*)\\(`);

  let cursor = '';
  let count = 100;
  let canIterate = true;

  while (canIterate) {
    const replacement = `$1${fieldName}$2(first: ${count}, after: '${cursor}', `;
    const query = queryOrig.replace(regex, replacement);
    const res = await gqlGet(query);
    if (!res.data && !res.errors) {
      count = Math.floor(count / 2);
      if (count === 0) {
        logger.info({ query, res }, 'No graphql res.data');
        canIterate = false;
      }
    } else if (res.data.repository && res.data.repository[fieldName]) {
      const { nodes, pageInfo } = res.data.repository[fieldName];
      result.push(...nodes);
      if (pageInfo.hasNextPage) {
        cursor = pageInfo.startCursor;
      } else {
        canIterate = false;
      }
    } else {
      logger.info(
        { query, res },
        `No graphql data found for field ${fieldName}`
      );
      canIterate = false;
    }
  }

  return result;
}
