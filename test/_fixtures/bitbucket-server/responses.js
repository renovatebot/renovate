function generateRepo(projectKey, repositorySlug) {
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
          href: `https://stash.renovatebot.com/scm/${projectKeyLower}/${repositorySlug}.git`,
          name: 'http',
        },
        {
          href: `ssh://git@stash.renovatebot.com:7999/${projectKeyLower}/${repositorySlug}.git`,
          name: 'ssh',
        },
      ],
      self: [
        {
          href: `https://stash.renovatebot.com/projects/${projectKey}/repos/${repositorySlug}/browse`,
        },
      ],
    },
  };
}

function generatePR(projectKey, repositorySlug) {
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
          self: [{ href: 'https://stash.renovatebot.com/users/userName1' }],
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
            self: [{ href: 'https://stash.renovatebot.com/users/userName2' }],
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
          href: `https://stash.renovatebot.com/projects/${projectKey}/repos/${repositorySlug}/pull-requests/5`,
        },
      ],
    },
  };
}

module.exports = {
  baseURL: "https://stash.renovatebot.com/",
  '/rest/api/1.0/projects': {
    size: 1,
    limit: 100,
    isLastPage: true,
    values: [
      {
        key: 'SOME',
        id: 1964,
        name: 'Some',
        public: false,
        type: 'NORMAL',
        links: {
          self: [{ href: 'https://stash.renovatebot.com/projects/SOME' }],
        },
      },
    ],
    start: 0,
  },
  '/rest/api/1.0/projects/SOME/repos': {
    size: 1,
    limit: 25,
    isLastPage: true,
    values: [generateRepo('SOME', 'repo')],
    start: 0,
  },
  '/rest/api/1.0/projects/SOME/repos/repo': generateRepo('SOME', 'repo'),
  '/rest/api/1.0/projects/SOME/repos/repo/issues': {
    // TODO - I'm not sure there is an issues link to provide
    values: [],
  },
  '/rest/api/1.0/projects/SOME/repos/repo/pullrequests': {
    values: [generatePR()],
  },
  '/rest/api/1.0/projects/SOME/repos/repo/pullrequests/5': generatePR(),
  '/rest/api/1.0/projects/SOME/repos/repo/pullrequests/5/diff': {
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
                    line: '    "prepare": "npm run clean && npm run build",',
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
                  { source: 64, destination: 64, line: '}', truncated: false },
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
  '/rest/api/1.0/projects/SOME/repos/repo/pullrequests/5/commits': {
    values: [{}],
  },
  '/rest/api/1.0/projects/SOME/repos/branches': {
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
};
