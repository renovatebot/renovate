const get = require('./gh-got-wrapper');

let repoOwner = '';
let repoName = '';
let repoItem = '';
let repoItemFilterBy = '';
let repoItemNodeList = [];
let repoResultNumEls = 100;

const graphql = {};

graphql.setRepoOwner = owner => {
  repoOwner = owner;
};

graphql.setRepoName = name => {
  repoName = name;
};

graphql.setRepoItem = item => {
  repoItem = item;
};

graphql.setRepoItemFilterBy = itemFilterBy => {
  repoItemFilterBy = itemFilterBy;
};

graphql.setRepoItemNodeList = itemNodeList => {
  repoItemNodeList = itemNodeList;
};

graphql.setRepoResultNumEls = numEls => {
  repoResultNumEls = numEls;
};

// returns [successStatus, repo.item.nodes, nextCursor]
graphql.get = async (cursor = '') => {
  const url = 'graphql';
  const headers = {
    accept: 'application/vnd.github.merge-info-preview+json',
  };
  const afterCursor = cursor === '' ? null : `"${cursor}"`;
  // prettier-ignore
  const nodeListString = repoItemNodeList.join('\n');
  const query = `
  query {
    repository(owner: "${repoOwner}", name: "${repoName}") {
      ${repoItem}(first: ${repoResultNumEls}, after:${afterCursor}, orderBy: {field: UPDATED_AT, direction: DESC}, filterBy: ${repoItemFilterBy}) {
        pageInfo {
          startCursor
          hasNextPage
        }
        nodes {
          ${nodeListString}
        }
      }
    }
  }
  `;

  const options = {
    headers,
    body: JSON.stringify({ query }),
    json: false,
  };

  try {
    const res = JSON.parse((await get.post(url, options)).body);

    if (!res.data) {
      // retry query until numElements == 1
      if (repoResultNumEls === 1) {
        logger.info({ query, res }, 'No graphql res.data');
        return [false, [], ''];
      }

      repoResultNumEls = parseInt(repoResultNumEls / 2);
      return graphql.get(cursor);
    }

    const nextCursor = res.data.repository[repoItem].pageInfo.hasNextPage
      ? res.data.repository[repoItem].pageInfo.startCursor
      : '';

    return [true, res.data.repository[repoItem].nodes, nextCursor];
  } catch (err) {
    logger.warn({ query, err }, 'graphql.get error');
    return [false, [], ''];
  }
};

graphql.getAll = async () => {
  let [success, elements, nextCursor] = await graphql.get('');
  let allElements = [];

  while (success) {
    allElements.push(...elements);

    if (!nextCursor) {
      break;
    }

    [success, elements, nextCursor] = await graphql.get(nextCursor);
  }

  return allElements;
};

module.exports = {
  graphql,
};
