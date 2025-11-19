// Parses the ISO date string and checks it's past the age window
// Co-authored-by: GPT-4.1 (GitHub Copilot)
function isOlderThanDaysAgo(dateString, daysAgo) {
  const parsedDate = new Date(dateString);
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return parsedDate < thresholdDate;
}

module.exports = async ({ github, context, discussionAnsweredDays }) => {
  const owner = context.repo.owner;
  const repo = context.repo.repo;

  let cursor = null;

  const query = `query ($cursor: String) {
  repository(owner: "${owner}", name: "${repo}") {
    discussions(after: $cursor, states: OPEN, answered: true, first: 10, orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo {
        endCursor
        hasNextPage
      }
      edges {
        node {
          id
          answerChosenAt
        }
      }
    }
  }
}`;

  let pageNumber = 0;
  while (true) {
    console.debug({ cursor }, 'Starting query');
    const { repository } = await github.graphql(query, { cursor });

    console.debug(
      { pageNumber },
      `Found ${repository.discussions.edges.length} discussions in this page of data`,
    );

    let numMutating = 0;
    let mutation = 'mutation {';
    for (let i in repository.discussions.edges) {
      let edge = repository.discussions.edges[i];
      if (
        isOlderThanDaysAgo(edge.node.answerChosenAt, discussionAnsweredDays)
      ) {
        mutation += `m${i}: closeDiscussion(input: {discussionId: "${edge.node.id}"}) {
    clientMutationId
    }\n`;
        numMutating++;
      }
    }
    mutation += '}';

    if (numMutating > 0) {
      console.debug(
        { pageNumber },
        `Attempting the following mutation:\n${mutation}`,
      );

      await github.graphql(mutation);

      console.log({ pageNumber }, `Closed ${numMutating} answered Discussions`);
    } else {
      console.debug(
        { pageNumber },
        `Did not find any Discussions to close in this page of data`,
      );
    }

    if (!repository.discussions.pageInfo.hasNextPage) {
      break;
    }

    pageNumber++;
    cursor = repository.discussions.pageInfo.endCursor;

    // wait 5 seconds between each call, to reduce GitHub API rate limits
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  return '';
};
