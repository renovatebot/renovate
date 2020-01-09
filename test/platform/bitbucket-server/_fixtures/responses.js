const { URL } = require('url');

function generateRepo(endpoint, projectKey, repositorySlug) {
  let projectKeyLower = projectKey.toLowerCase();
  return {
    slug: repositorySlug,
    id: 13076,
    name: repositorySlug,
    scmId: 'git',
    state: 'AVAILABLE',
    statusMessage: 'Available',
    forkable: true,
    project: {
      key: projectKey,
      id: 2900,
      name: `${repositorySlug}'s name`,
      public: false,
      type: 'NORMAL',
      links: {
        self: [
          { href: `https://stash.renovatebot.com/projects/${projectKey}` },
        ],
      },
    },
    public: false,
    links: {
      clone: [
        {
          href: `${endpoint}/scm/${projectKeyLower}/${repositorySlug}.git`,
          name: 'http',
        },
        {
          href: `ssh://git@stash.renovatebot.com:7999/${projectKeyLower}/${repositorySlug}.git`,
          name: 'ssh',
        },
      ],
      self: [
        {
          href: `${endpoint}/projects/${projectKey}/repos/${repositorySlug}/browse`,
        },
      ],
    },
  };
}

function generatePR(endpoint, projectKey, repositorySlug) {
  return {
    id: 5,
    version: 1,
    title: 'title',
    description: '* Line 1\r\n* Line 2',
    state: 'OPEN',
    open: true,
    closed: false,
    createdDate: 1547853840016,
    updatedDate: 1547853840016,
    fromRef: {
      id: 'refs/heads/userName1/pullRequest5',
      displayId: 'userName1/pullRequest5',
      latestCommit: '55efc02b2ab13a43a66cf705f5faacfcc6a762b4',
      // Removed this with the idea it's not needed
      // repository: {},
    },
    toRef: {
      id: 'refs/heads/master',
      displayId: 'master',
      latestCommit: '0d9c7726c3d628b7e28af234595cfd20febdbf8e',
      // Removed this with the idea it's not needed
      // repository: {},
    },
    locked: false,
    author: {
      user: {
        name: 'userName1',
        emailAddress: 'userName1@renovatebot.com',
        id: 144846,
        displayName: 'Renovate Bot',
        active: true,
        slug: 'userName1',
        type: 'NORMAL',
        links: {
          self: [{ href: `${endpoint}/users/userName1` }],
        },
      },
      role: 'AUTHOR',
      approved: false,
      status: 'UNAPPROVED',
    },
    reviewers: [
      {
        user: {
          name: 'userName2',
          emailAddress: 'userName2@renovatebot.com',
          id: 71155,
          displayName: 'Renovate bot 2',
          active: true,
          slug: 'userName2',
          type: 'NORMAL',
          links: {
            self: [{ href: `${endpoint}/users/userName2` }],
          },
        },
        role: 'REVIEWER',
        approved: false,
        status: 'UNAPPROVED',
      },
    ],
    participants: [],
    links: {
      self: [
        {
          href: `${endpoint}/projects/${projectKey}/repos/${repositorySlug}/pull-requests/5`,
        },
      ],
    },
  };
}

function generateServerResponses(endpoint) {
  return {
    baseURL: endpoint,
    [`${endpoint}/rest/api/1.0/repos?permission=REPO_WRITE&state=AVAILABLE&limit=100`]: {
      GET: {
        size: 1,
        limit: 100,
        isLastPage: true,
        values: [generateRepo(endpoint, 'SOME', 'repo')],
        start: 0,
      },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos?limit=100`]: {
      GET: {
        size: 1,
        limit: 25,
        isLastPage: true,
        values: [generateRepo(endpoint, 'SOME', 'repo')],
        start: 0,
      },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo`]: {
      GET: generateRepo(endpoint, 'SOME', 'repo'),
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/branches/default`]: {
      GET: {
        displayId: 'master',
      },
    },
    // // TODO - I'm not sure there is an issues link to provide
    // [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/issues`]: {
    //   'GET': {
    //     values: [],
    //   },
    // },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests`]: {
      POST: generatePR(endpoint, 'SOME', 'repo'),
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests?state=ALL&role.1=AUTHOR&username.1=abc&limit=100`]: {
      GET: {
        isLastPage: true,
        values: [generatePR(endpoint, 'SOME', 'repo')],
      },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/3`]: {
      GET: generatePR(endpoint, 'SOME', 'repo'),
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/3/merge`]: {
      GET: { conflicted: false },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/3/commits?withCounts=true`]: {
      GET: {
        totalCount: 2,
      },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/4`]: {
      GET: Promise.reject({ statusCode: 404 }),
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5`]: {
      GET: generatePR(endpoint, 'SOME', 'repo'),
      PUT: generatePR(endpoint, 'SOME', 'repo'),
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/commits?withCounts=true`]: {
      GET: {
        totalCount: 1,
        values: [ { author: { emailAddress: 'bot@renovateapp.com'} } ],
      },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/participants`]: {
      POST: {
        user: {
          name: 'jcitizen',
          emailAddress: 'jane@example.com',
          id: 101,
          displayName: 'Jane Citizen',
          active: true,
          slug: 'jcitizen',
          type: 'NORMAL',
        },
        lastReviewedCommit: '7549846524f8aed2bd1c0249993ae1bf9d3c9998',
        role: 'REVIEWER',
        approved: false,
        status: 'UNAPPROVED',
      },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/diff`]: {
      GET: {
        fromHash: 'afdcf5e55dfce85055a146783434b0e2a81722c1',
        toHash: '590e661bb8c189b5a4bee115b475c9f14bf112bd',
        contextLines: 10,
        whitespace: 'SHOW',
        diffs: [
          {
            source: {
              components: ['package.json'],
              parent: '',
              name: 'package.json',
              extension: 'json',
              toString: 'package.json',
            },
            destination: {
              components: ['package.json'],
              parent: '',
              name: 'package.json',
              extension: 'json',
              toString: 'package.json',
            },
            hunks: [
              {
                sourceLine: 47,
                sourceSpan: 18,
                destinationLine: 47,
                destinationSpan: 18,
                segments: [
                  {
                    type: 'CONTEXT',
                    lines: [
                      {
                        source: 47,
                        destination: 47,
                        line: '    "webpack": "4.28.0"',
                        truncated: false,
                      },
                      {
                        source: 48,
                        destination: 48,
                        line: '  },',
                        truncated: false,
                      },
                      {
                        source: 49,
                        destination: 49,
                        line: '  "license": "MIT",',
                        truncated: false,
                      },
                      {
                        source: 50,
                        destination: 50,
                        line: '  "main": "dist/index.js",',
                        truncated: false,
                      },
                      {
                        source: 51,
                        destination: 51,
                        line: '  "module": "dist/index.es.js",',
                        truncated: false,
                      },
                      {
                        source: 52,
                        destination: 52,
                        line: '  "name": "removed-for-privacy",',
                        truncated: false,
                      },
                      {
                        source: 53,
                        destination: 53,
                        line: '  "publishConfig": {',
                        truncated: false,
                      },
                      {
                        source: 54,
                        destination: 54,
                        line: '    "registry": "https://npm.renovatebot.com/"',
                        truncated: false,
                      },
                      {
                        source: 55,
                        destination: 55,
                        line: '  },',
                        truncated: false,
                      },
                      {
                        source: 56,
                        destination: 56,
                        line: '  "scripts": {',
                        truncated: false,
                      },
                    ],
                    truncated: false,
                  },
                  {
                    type: 'REMOVED',
                    lines: [
                      {
                        source: 57,
                        destination: 57,
                        line:
                          '    "build": "TS_NODE_PROJECT=\\"tsconfig.webpack.json\\" webpack --config=webpack.config.prod.ts",',
                        truncated: false,
                      },
                    ],
                    truncated: false,
                  },
                  {
                    type: 'ADDED',
                    lines: [
                      {
                        source: 58,
                        destination: 57,
                        line:
                          '    "build": "npm run env TS_NODE_PROJECT=\\"tsconfig.webpack.json\\" -- && webpack --config=webpack.config.prod.ts",',
                        truncated: false,
                      },
                    ],
                    truncated: false,
                  },
                  {
                    type: 'CONTEXT',
                    lines: [
                      {
                        source: 58,
                        destination: 58,
                        line: '    "clean": "rimraf dist",',
                        truncated: false,
                      },
                    ],
                    truncated: false,
                  },
                  {
                    type: 'REMOVED',
                    lines: [
                      {
                        source: 59,
                        destination: 59,
                        line:
                          '    "dev": "TS_NODE_PROJECT=\\"tsconfig.webpack.json\\" webpack --config=webpack.config.ts",',
                        truncated: false,
                      },
                    ],
                    truncated: false,
                  },
                  {
                    type: 'ADDED',
                    lines: [
                      {
                        source: 60,
                        destination: 59,
                        line:
                          '    "dev": "npm run env TS_NODE_PROJECT=\\"tsconfig.webpack.json\\" -- && webpack --config=webpack.config.ts",',
                        truncated: false,
                      },
                    ],
                    truncated: false,
                  },
                  {
                    type: 'CONTEXT',
                    lines: [
                      {
                        source: 60,
                        destination: 60,
                        line:
                          '    "prepare": "npm run clean && npm run build",',
                        truncated: false,
                      },
                    ],
                    truncated: false,
                  },
                  {
                    type: 'REMOVED',
                    lines: [
                      {
                        source: 61,
                        destination: 61,
                        line:
                          '    "start": "TS_NODE_PROJECT=\\"tsconfig.webpack.json\\" webpack-dev-server --env.NODE_ENV=development --env.buildenv=stage"',
                        truncated: false,
                      },
                    ],
                    truncated: false,
                  },
                  {
                    type: 'ADDED',
                    lines: [
                      {
                        source: 62,
                        destination: 61,
                        line:
                          '    "start": "npm run env TS_NODE_PROJECT=\\"tsconfig.webpack.json\\" -- && webpack-dev-server --env.NODE_ENV=development --env.buildenv=stage"',
                        truncated: false,
                      },
                    ],
                    truncated: false,
                  },
                  {
                    type: 'CONTEXT',
                    lines: [
                      {
                        source: 62,
                        destination: 62,
                        line: '  },',
                        truncated: false,
                      },
                      {
                        source: 63,
                        destination: 63,
                        line: '  "version": "0.0.1"',
                        truncated: false,
                      },
                      {
                        source: 64,
                        destination: 64,
                        line: '}',
                        truncated: false,
                      },
                    ],
                    truncated: false,
                  },
                ],
                truncated: false,
              },
            ],
            truncated: false,
          },
        ],
        truncated: false,
      },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/changes?withComments=false&limit=100`]: {
      GET: {
        "size": 1,
        "limit": 25,
        "isLastPage": true,
        "values": [
            {
                "contentId": "5c279d6c7a3a053a145905aa9682ce02c16449e9",
                "fromContentId": "7b86ad1a05b4259b8fa54497a8be0bd359a405bd",
                "path": {
                    "components": [
                        "path",
                        "to",
                        "unreviewed",
                        "file.txt"
                    ],
                    "parent": "path/to/unreviewed",
                    "name": "file.txt",
                    "extension": "txt",
                    "toString": "path/to/unreviewed/file.txt"
                },
                "executable": false,
                "percentUnchanged": 98,
                "type": "MOVE",
                "nodeType": "FILE",
                "srcPath": {
                    "components": [
                        "path",
                        "to",
                        "file.txt"
                    ],
                    "parent": "path/to",
                    "name": "file.txt",
                    "extension": "txt",
                    "toString": "path/to/file.txt"
                },
                "srcExecutable": false,
                "links": {
                    "self": [
                        null
                    ]
                },
                "properties": {
                    "unreviewedCommits": 1
                }
            }
        ],
        "start": 0
      },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/commits`]: {
      GET: {
        values: [{}],
      },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/merge`]: {
      GET: { conflicted: false },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/merge?version=1`]: {
      POST: {
        ...generatePR(endpoint, 'SOME', 'repo'),
        ...{
          state: 'MERGED',
          open: false,
          closed: true,
          createdDate: 1547853840016,
          updatedDate: 1547853840016,
          closedDate: 1547853840017,
        },
      },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100`]: {
      GET: {
        isLastPage: false,
        nextPageStart: 1,
        values: [
          {
            action: 'COMMENTED',
            commentAction: 'ADDED',
            comment: { id: 21, text: '### some-subject\n\nblablabla' },
          },
          {
            action: 'COMMENTED',
            commentAction: 'ADDED',
            comment: { id: 22, text: '!merge' },
          },
        ],
      },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/activities?limit=100&start=1`]: {
      GET: {
        isLastPage: true,
        values: [{ action: 'OTHER' }],
      },
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/comments`]: {
      POST: {},
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/comments/21`]: {
      GET: {
        version: 1,
      },
      PUT: {},
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/comments/22`]: {
      GET: {
        version: 1,
      },
      PUT: {},
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/repo/pull-requests/5/comments/21?version=1`]: {
      DELETE: {},
    },
    [`${endpoint}/rest/api/1.0/projects/SOME/repos/branches`]: {
      GET: {
        isLastPage: true,
        limit: 25,
        size: 2,
        start: 0,
        values: [
          { displayId: 'master', id: 'refs/heads/master' },
          { displayId: 'branch', id: 'refs/heads/branch' },
          { displayId: 'renovate/branch', id: 'refs/heads/renovate/branch' },
          { displayId: 'renovate/upgrade', id: 'refs/heads/renovate/upgrade' },
        ],
      },
    },
    [`${endpoint}/rest/build-status/1.0/commits/stats/0d9c7726c3d628b7e28af234595cfd20febdbf8e`]: {
      GET: {},
    },
    [`${endpoint}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e?limit=100`]: {
      GET: {
        isLastPage: true,
        values: [{ key: 'context-1', state: 'SUCCESSFUL' }],
      },
    },
    [`${endpoint}/rest/build-status/1.0/commits/0d9c7726c3d628b7e28af234595cfd20febdbf8e`]: {
      POST: {},
    },
    [`${endpoint}/rest/default-reviewers/1.0/projects/SOME/repos/repo/reviewers?sourceRefId=refs/heads/branch&targetRefId=refs/heads/master&sourceRepoId=13076&targetRepoId=13076`]: {
      GET: [{ name: 'jcitizen' }],
    },
  };
}

module.exports = {
  'endpoint with no path': generateServerResponses(
    'https://stash.renovatebot.com'
  ),
  'endpoint with path': generateServerResponses(
    'https://stash.renovatebot.com/vcs'
  ),
};
