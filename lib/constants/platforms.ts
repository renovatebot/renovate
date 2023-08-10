export type PlatformId =
  | 'azure'
  | 'codecommit'
  | 'bitbucket'
  | 'bitbucket-server'
  | 'gitea'
  | 'github'
  | 'gitlab'
  | 'local';

export const GITHUB_API_USING_HOST_TYPES = [
  'github',
  'github-releases',
  'github-release-attachments',
  'github-tags',
  'pod',
  'hermit',
  'github-changelog',
];

export const GITLAB_API_USING_HOST_TYPES = [
  'gitlab',
  'gitlab-releases',
  'gitlab-tags',
  'gitlab-packages',
  'gitlab-changelog',
];

export const BITBUCKET_API_USING_HOST_TYPES = [
  'bitbucket',
  'bitbucket-changelog',
  'bitbucket-tags',
];
