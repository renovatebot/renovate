const url = require('url');
const FormData = require('form-data');
const api = require('./bb-got-wrapper');

const repoInfoTransformer = (repoInfoBody = {}) => ({
  privateRepo: repoInfoBody.is_private,
  isFork: !!repoInfoBody.parent,
  repoFullName: repoInfoBody.full_name,
  // if cloud info is available use it, else use server data
  owner: repoInfoBody.owner
    ? repoInfoBody.owner.username
    : repoInfoBody.project.key,
  // if cloud info is available use it, server doesnt have it
  mainbranch: repoInfoBody.mainbranch
    ? repoInfoBody.mainbranch.name
    : undefined,
  mergeMethod: 'merge',
});

const prStates = {
  open: ['OPEN'],
  notOpen: ['MERGED', 'DECLINED', 'SUPERSEDED'],
  merged: ['MERGED'],
  closed: ['DECLINED', 'SUPERSEDED'],
  all: ['OPEN', 'MERGED', 'DECLINED', 'SUPERSEDED'],
};

const buildStates = {
  success: 'SUCCESSFUL',
  failed: 'FAILED',
  pending: 'INPROGRESS',
};

const addMaxLength = (inputUrl, pagelen = 100) => {
  const { search, ...parsedUrl } = url.parse(inputUrl, true);
  const maxedUrl = url.format({
    ...parsedUrl,
    query: { ...parsedUrl.query, pagelen },
  });
  return maxedUrl;
};

const addMaxLengthV2 = (inputUrl, limit = 100) => {
  const { search, ...parsedUrl } = url.parse(inputUrl, true);
  const maxedUrl = url.format({
    ...parsedUrl,
    query: { ...parsedUrl.query, limit },
  });
  return maxedUrl;
};

const filesEndpoint = async (reqUrl, method = 'get', options) => {
  const values = await accumulateValues(reqUrl, method, options);
  const commitFolders = values.filter(
    value => value.type === 'commit_directory'
  );
  let commitFiles = values.filter(value => value.type === 'commit_file');

  if (
    process.env.RENOVATE_DISABLE_FILE_RECURSION !== 'true' &&
    commitFolders.length !== 0
  ) {
    const moreFiles = [].concat(
      ...(await Promise.all(
        commitFolders
          .map(folder => folder.links.self.href)
          .filter(Boolean)
          .map(selfUrl => filesEndpoint(selfUrl, method, options))
      ))
    );
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

const accumulateValuesV2 = async (reqUrl, method = 'get', options, limit) => {
  let accumulator = [];
  let nextUrl = addMaxLengthV2(reqUrl, limit);
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

// istanbul ignore next
const isConflicted = files => {
  for (const file of files) {
    for (const chunk of file.chunks) {
      for (const change of chunk.changes) {
        if (change.content === '+=======') {
          return true;
        }
      }
    }
  }
  return false;
};

const commitForm = ({ message, gitAuthor, parents, branchName, files }) => {
  const form = new FormData();
  form.append('message', message);
  // istanbul ignore if
  if (gitAuthor) {
    form.append('author', gitAuthor);
  }
  form.append('parents', parents);
  form.append('branch', branchName);
  files.forEach(({ name, contents }) => {
    form.append(`/${name}`, contents);
  });
  return form;
};

const commitFormServer = ({
  message,
  gitAuthor,
  sourceCommitId,
  branchName,
  file,
}) => {
  console.log(file);
  const form = new FormData();
  form.append('message', message);
  // istanbul ignore if
  // if (gitAuthor) {
  //   form.append('author', gitAuthor);
  // }
  form.append('sourceCommitId', sourceCommitId);
  form.append('branch', branchName);
  form.append('content', file.contents);

  return form;
};

const prop = (x = '') => (o = {}) => o[x];
const path = (xs = []) => (o = {}) =>
  xs.reduce((state = {}, item = '') => state[item], o);

const prInfo = pr => ({
  number: pr.id,
  // Cloud has summary, but Server has description
  body: (pr.summary ? pr.summary.raw : undefined) || pr.description,
  branchName:
    path(['source', 'branch', 'name'])(pr) ||
    path(['fromRef', 'displayId'])(pr),
  title: pr.title,
  state: prStates.closed.includes(pr.state) ? 'closed' : pr.state.toLowerCase(),
  createdAt: pr.created_on,
});

module.exports = {
  repoInfoTransformer,
  prStates,
  buildStates,
  prInfo,
  accumulateValues,
  accumulateValuesV2,
  files: filesEndpoint,
  isConflicted,
  commitForm,
  commitFormServer,
};
