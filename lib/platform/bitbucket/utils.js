const url = require('url');
const FormData = require('form-data');
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

const filesEndpoint = async (reqUrl, method = 'get', options) => {
  const values = await accumulateValues(reqUrl, method, options);
  const commitFolders = values.filter(
    value => value.type === 'commit_directory'
  );
  let commitFiles = values.filter(value => value.type === 'commit_file');

  if (commitFolders.length !== 0) {
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
  // The commit message. When omitted, Bitbucket uses a canned string.
  form.append('message', message);

  // The raw string to be used as the new commit's author. This string follows the format "Erik van Zijst evzijst@atlassian.com".
  // When omitted, Bitbucket uses the authenticated user's full/display name and primary email address. Commits cannot be created anonymously.
  if (gitAuthor) {
    form.append('author', gitAuthor);
  }

  // A comma-separated list of SHA1s of the commits that should be the parents of the newly created commit.
  // When omitted, the new commit will inherit from and become a child of the main branch's tip/HEAD commit.
  // When more than one SHA1 is provided, the first SHA1 identifies the commit from which the content will be inherited.
  // When more than 2 parents are provided on a Mercurial repo, a 400 is returned as Mercurial does not support "octopus merges".
  form.append('parents', parents);

  // The name of the branch that the new commit should be created on. When omitted, the commit will be created on top of the main branch and will become the main branch's new head.
  // When a branch name is provided that already exists in the repo, then the commit will be created on top of that branch. In this case, if a parent SHA1 was also provided, then it is asserted that the parent is the branch's tip/HEAD at the time the request is made. When this is not the case, a 409 is returned.
  // This API cannot be used to create new anonymous heads in Mercurial repositories.
  // When a new branch name is specified (that does not already exist in the repo), and no parent SHA1s are provided, then the new commit will inherit from the current main branch's tip/HEAD commit, but not advance the main branch. The new commit will be the new branch. When the request also specifies a parent SHA1, then the new commit and branch are created directly on top of the parent commit, regardless of the state of the main branch.
  // When a branch name is not specified, but a parent SHA1 is provided, then Bitbucket asserts that it represents the main branch's current HEAD/tip, or a 409 is returned.
  // When a branch name is not specified and the repo is empty, the new commit will become the repo's root commit and will be on the main branch.
  // When a branch name is specified and the repo is empty, the new commit will become the repo's root commit and also define the repo's main branch going forward.
  // This API cannot be used to create additional root commits in non-empty repos.
  // The branch field cannot be repeated.
  // As a side effect, this API can be used to create a new branch without modifying any files, by specifying a new branch name in this field, together with parents, but omitting the files fields, while not sending any files. This will create a new commit and branch with the same contents as the first parent. The diff of this commit against its first parent will be empty.
  form.append('branch', branchName);

  // Optional field that declares the files that the request is manipulating. When adding a new file to a repo, or when overwriting an existing file, the client can just upload the full contents of the file in a normal form field and the use of this files meta data field is redundant. However, when the files field contains a file path that does not have a corresponding, identically-named form field, then Bitbucket interprets that as the client wanting to replace the named file with the null set and the file is deleted instead.
  // Paths in the repo that are referenced in neither files nor an individual file field, remain unchanged and carry over from the parent to the new commit.
  // This API does not support renaming as an explicit feature. To rename a file, simply delete it and recreate it under the new name in the same commit.
  files.forEach(({ name, contents }) => {
    form.append(`/${name}`, contents);
  });

  return form;
};

const prInfo = pr => ({
  number: pr.id,
  body: pr.summary ? pr.summary.raw : undefined,
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
  files: filesEndpoint,
  isConflicted,
  commitForm,
};
