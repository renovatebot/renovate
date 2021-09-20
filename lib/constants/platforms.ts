export const PLATFORM_TYPE_AZURE = 'azure';
export const PLATFORM_TYPE_BITBUCKET = 'bitbucket';
export const PLATFORM_TYPE_BITBUCKET_SERVER = 'bitbucket-server';
export const PLATFORM_TYPE_GITEA = 'gitea';
export const PLATFORM_TYPE_GITHUB = 'github';
export const PLATFORM_TYPE_GITLAB = 'gitlab';

export const GITHUB_API_USING_HOST_TYPES = [
  PLATFORM_TYPE_GITHUB,
  'github-releases',
  'github-tags',
  'pod',
];

export const GITLAB_API_USING_HOST_TYPES = [
  PLATFORM_TYPE_GITLAB,
  'gitlab-releases',
  'gitlab-tags',
  'gitlab-packages',
];
