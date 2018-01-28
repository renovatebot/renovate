const url = require('url');
const R = require('./nanoramda');
const api = require('./bb-got');

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

const buildStates = {
  success: 'SUCCESSFUL',
  failed: 'FAILED',
  pending: 'INPROGRESS',
};

const addMaxLength = (inputUrl, pagelen=100) => {
  const parsedUrl = R.dissoc('search', url.parse(inputUrl, true));
  const maxedUrl = url.format(
    R.merge(parsedUrl, { query: R.merge(parsedUrl.query, { pagelen }) })
  );
  return maxedUrl;
};

const files = async (reqUrl, method = 'get', options) => {
  const values = await accumulateValues(reqUrl, method, options);
  const commitFolders = values.filter(R.propEq('type', 'commit_directory'));
  let commitFiles = values.filter(R.propEq('type', 'commit_file'));

  if (commitFolders.length !== 0) {
    const moreFiles = (await Promise.all(
      commitFolders
        .map(R.path(['links', 'self', 'href']))
        .filter(Boolean)
        .map(selfUrl => files(selfUrl, method, options))
    )).reduce(R.concat, []);
    commitFiles = [...moreFiles, ...commitFiles];
  }

  return commitFiles;
};

const accumulateValues = async (reqUrl, method = 'get', options, pagelen) => {
  let accumulator = [];
  let nextUrl = addMaxLength(reqUrl, pagelen);
  const lowerCaseMethod = method.toLocaleLowerCase();

  while (typeof nextUrl !== 'undefined') {
    const { body } = await api[lowerCaseMethod](nextUrl, options);
    accumulator = [...accumulator, ...body.values];
    nextUrl = body.next;
  }

  return accumulator;
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
  buildStates,
  addMaxLength,
  prInfo,
  accumulateValues,
  files,
};
