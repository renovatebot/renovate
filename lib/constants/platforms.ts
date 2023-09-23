export type PlatformId =
  | 'azure'
  | 'codecommit'
  | 'bitbucket'
  | 'bitbucket-server'
  | 'gitea'
  | 'github'
  | 'gitlab'
  | 'local';

export const GITEA_API_USING_HOST_TYPES = [
  'gitea',
  'gitea-changelog',
  'gitea-releases',
  'gitea-tags',
  'custom',
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
  'custom',
];

export const GITLAB_API_USING_HOST_TYPES = [
  'gitlab',
  'gitlab-releases',
  'gitlab-tags',
  'gitlab-packages',
  'gitlab-changelog',
  'pypi',
  'custom',
];

export const BITBUCKET_API_USING_HOST_TYPES = [
  'bitbucket',
  'bitbucket-changelog',
  'bitbucket-tags',
  'custom',
];
