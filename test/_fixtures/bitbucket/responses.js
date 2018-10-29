
const pr = {
  id: 5,
  source: { branch: { name: 'branch' } },
  title: 'title',
  summary: { raw: 'summary' },
  state: 'OPEN',
  created_on: '2018-07-02T07:02:25.275030+00:00',
  links: {
    commits: {
      href:
        'https://api.bitbucket.org/2.0/repositories/some/repo/pullrequests/5/commits',
    },
  },
};
const issue = {
  id: 25,
  title: 'title',
  content: { raw: 'content' },
};

const repo = {
  is_private: false,
  full_name: 'some/repo',
  owner: { username: 'some' },
  mainbranch: { name: 'master' },
};
function notFound() {
  const err = new Error('Not found');
  err.statusCode = 404;
  throw err;
}

module.exports = {
  '/2.0/user': {
    username: 'nobody',
  },
  '/2.0/repositories/some/repo': repo,
  '/2.0/repositories/some/empty': {...repo, full_name : 'some/empty'},
  '/2.0/repositories/some/empty/issues': {
    values: [],
  },
  '/2.0/repositories/some/repo/issues': {
    values: [issue, {...issue, id:26}],
  },
  '/2.0/repositories/some/repo/pullrequests': {
    values: [pr],
  },
  '/2.0/repositories/some/repo/pullrequests/5': pr,
  '/2.0/repositories/some/repo/pullrequests/5/diff': `
    diff --git a/requirements.txt b/requirements.txt
    index 7e08d70..f5283ca 100644
    --- a/requirements.txt
    +++ b/requirements.txt
    @@ -7,7 +7,7 @@ docutils==0.12
    enum34==1.1.6
    futures==3.2.0
    isort==4.3.4
    -jedi==0.11.1
    +jedi==0.12.1
    lazy-object-proxy==1.3.1
    lxml==3.6.0
    mccabe==0.6.1
  `
    .trim()
    .replace(/^\s+/g, ''),
  '/2.0/repositories/some/repo/pullrequests/5/commits': {
    values: [{}],
  },
  '/2.0/repositories/some/repo/refs/branches': {
    values: [
      { name: 'master' },
      { name: 'branch' },
      { name: 'renovate/branch' },
      { name: 'renovate/upgrade' },
    ],
  },
  '/2.0/repositories/some/repo/refs/branches/master': {
    name: 'master',
    target: { hash: 'master_hash' },
  },
  '/2.0/repositories/some/repo/refs/branches/branch': {
    name: 'branch',
    target: {
      hash: 'branch_hash',
      parents: [{ hash: 'master_hash' }],
    },
  },
  '/2.0/repositories/some/repo/refs/branches/not_found': notFound,
  '/!api/1.0/repositories/some/repo/directory/master_hash': {
    values: ['foo_folder/foo_file', 'bar_file'],
  },
  '/!api/1.0/repositories/some/repo/directory/branch_hash': notFound,
  '/2.0/repositories/some/repo/src/branch_hash/': {
    values: [
      {
        path: 'foo_folder',
        type: 'commit_directory',
        links: {
          self: {
            href: '/2.0/repositories/some/repo/src/branch_hash/foo_folder/',
          },
        },
      },
      {
        path: 'bar_file',
        type: 'commit_file',
      },
    ],
  },
  '/2.0/repositories/some/repo/src/branch_hash/foo_folder/': {
    values: [
      {
        path: 'foo_folder/foo_file',
        type: 'commit_file',
      },
    ],
  },
  '/2.0/repositories/some/repo/src/branch_hash/bar_file': 'bar_file content',
  '/2.0/repositories/some/repo/src/branch_hash/not_found': notFound,
  '/2.0/repositories/some/repo/src/branch_hash/error': () => {
    throw new Error('Server error');
  },
  '/2.0/repositories/some/repo/commits': {
    values: [...Array(20).keys()].map(i => ({
      message: 'Commit messsage ' + i,
    })),
  },
  '/2.0/repositories/some/repo/commit/master_hash/statuses': {
    values: [
      {
        "key": "foo",
        "state": "FAILED",
      }
    ]
  },
};
