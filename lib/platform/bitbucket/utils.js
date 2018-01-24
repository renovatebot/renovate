const url = require('url');
const R = require('./nanoramda');

const repoInfoTransformer = repoInfoBody => ({
  privateRepo: repoInfoBody.is_private,
  isFork: !!repoInfoBody.parent,
  repoFullName: repoInfoBody.full_name,
  owner: repoInfoBody.owner.username,
  mainbranch: repoInfoBody.mainbranch.name,
  mergeMethod: 'merge',
});

const prStates = {
  open: ['OPEN'],
  merged: ['MERGED'],
  closed: ['DECLINED', 'SUPERSEDED'],
  all: ['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED'],
};

const addMaxLength = inputUrl => {
  const parsedUrl = R.dissoc('search', url.parse(inputUrl, true));
  const maxedUrl = url.format(
    R.merge(parsedUrl, { query: R.merge(parsedUrl.query, { length: 100 }) })
  );
  return maxedUrl;
};

const prInfo = pr => ({
  number: pr.id,
  branchName: pr.source.branch.name,
  title: pr.title,
  state: prStates.closed.includes(pr.state) ? 'closed' : pr.state.toLowerCase(),
  createdAt: pr.created_on,
});

module.exports = {
  repoInfoTransformer,
  prStates,
  addMaxLength,
  prInfo,
};
