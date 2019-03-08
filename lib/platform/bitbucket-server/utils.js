// SEE for the reference https://github.com/renovatebot/renovate/blob/c3e9e572b225085448d94aa121c7ec81c14d3955/lib/platform/bitbucket/utils.js
const url = require('url');
const api = require('./bb-got-wrapper');

// https://docs.atlassian.com/bitbucket-server/rest/6.0.0/bitbucket-rest.html#idp250
const prStateMapping = {
  MERGED: 'merged',
  DECLINED: 'closed',
  OPEN: 'open',
};

const prInfo = pr => ({
  version: pr.version,
  number: pr.id,
  body: pr.description,
  branchName: pr.fromRef.displayId,
  title: pr.title,
  state: prStateMapping[pr.state],
  createdAt: pr.createdDate,
});

const addMaxLength = (inputUrl, limit = 100) => {
  const { search, ...parsedUrl } = url.parse(inputUrl, true);
  const maxedUrl = url.format({
    ...parsedUrl,
    query: { ...parsedUrl.query, limit },
  });
  return maxedUrl;
};

const accumulateValues = async (reqUrl, method = 'get', options, limit) => {
  let accumulator = [];
  let nextUrl = addMaxLength(reqUrl, limit);
  const lowerCaseMethod = method.toLocaleLowerCase();

  while (typeof nextUrl !== 'undefined') {
    const { body } = await api[lowerCaseMethod](nextUrl, options);
    accumulator = [...accumulator, ...body.values];
    if (body.isLastPage !== false) break;

    const { search, ...parsedUrl } = url.parse(nextUrl, true);
    nextUrl = url.format({
      ...parsedUrl,
      query: {
        ...parsedUrl.query,
        start: body.nextPageStart,
      },
    });
  }

  return accumulator;
};

module.exports = {
  // buildStates,
  prInfo,
  accumulateValues,
  // files: filesEndpoint,
  // isConflicted,
  // commitForm,
};
