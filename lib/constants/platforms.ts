export type PlatformId =
  | 'azure'
  | 'bitbucket-server'
  | 'bitbucket'
  | 'gitea'
  | 'github'
  | 'gitlab';

export const GITHUB_API_USING_HOST_TYPES = [
  'github',
  'github-releases',
  'github-tags',
  'pod',
];

export const GITLAB_API_USING_HOST_TYPES = [
  'gitlab',
  'gitlab-releases',
  'gitlab-tags',
  'gitlab-packages',
];

export const BITBUCKET_API_USING_HOST_TYPES = ['bitbucket', 'bitbucket-tags'];
