export enum PlatformID {
  Azure = 'azure',
  Bitbucket = 'bitbucket',
  BitbucketServer = 'bitbucket-server',
  Gitea = 'gitea',
  Github = 'github',
  Gitlab = 'gitlab',
}

export const GITHUB_API_USING_HOST_TYPES = [
  PlatformID.Github,
  'github-releases',
  'github-tags',
  'pod',
];

export const GITLAB_API_USING_HOST_TYPES = [
  PlatformID.Gitlab,
  'gitlab-releases',
  'gitlab-tags',
];
