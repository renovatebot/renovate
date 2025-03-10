export const PLATFORM_HOST_TYPES = [
  'azure',
  'bitbucket',
  'bitbucket-server',
  'codecommit',
  'gerrit',
  'gitea',
  'github',
  'gitlab',
  'local',
] as const;

export type PlatformId = (typeof PLATFORM_HOST_TYPES)[number];

export const GITEA_API_USING_HOST_TYPES = [
  'gitea',
  'gitea-changelog',
  'gitea-releases',
  'gitea-tags',
];

export const GITHUB_API_USING_HOST_TYPES = [
  'github',
  'github-releases',
  'github-release-attachments',
  'github-tags',
  'pod',
  'hermit',
  'github-changelog',
  'conan',
];

export const GITLAB_API_USING_HOST_TYPES = [
  'gitlab',
  'gitlab-releases',
  'gitlab-tags',
  'gitlab-packages',
  'gitlab-changelog',
  'pypi',
];

export const BITBUCKET_API_USING_HOST_TYPES = [
  'bitbucket',
  'bitbucket-changelog',
  'bitbucket-tags',
];

export const BITBUCKET_SERVER_API_USING_HOST_TYPES = [
  'bitbucket-server',
  'bitbucket-server-changelog',
  'bitbucket-server-tags',
];
