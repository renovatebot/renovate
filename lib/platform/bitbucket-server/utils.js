// SEE for the reference https://github.com/renovatebot/renovate/blob/c3e9e572b225085448d94aa121c7ec81c14d3955/lib/platform/bitbucket/utils.js
const url = require('url');
const api = require('./bb-got-wrapper');

// TODO: Are the below states correct?
const prStates = {
  open: ['OPEN'],
  notOpen: ['MERGED', 'DECLINED', 'SUPERSEDED'],
  merged: ['MERGED'],
  closed: ['DECLINED', 'SUPERSEDED'],
  all: ['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED'],
};

const prInfo = pr => ({
  version: pr.version,
  number: pr.id,
  body: pr.description,
  branchName: pr.fromRef.displayId,
  title: pr.title,
  state: prStates.closed.includes(pr.state) ? 'closed' : pr.state.toLowerCase(),
  createdAt: pr.created_on,
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
    nextUrl = body.isLastPage
      ? undefined
      : url.format({
          ...url.parse(nextUrl),
          query: {
            ...url.parse(nextUrl, true).query,
            start: body.nextPageStart,
          },
        });
  }

  return accumulator;
};

module.exports = {
  prStates,
  // buildStates,
  prInfo,
  accumulateValues,
  // files: filesEndpoint,
  // isConflicted,
  // commitForm,
};
