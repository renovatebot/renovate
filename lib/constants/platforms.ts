// eslint-disable-next-line typescript-enum/no-enum, typescript-enum/no-const-enum
export const enum PlatformId {
  Azure = 'azure',
  Bitbucket = 'bitbucket',
  BitbucketServer = 'bitbucket-server',
  Gitea = 'gitea',
  Github = 'github',
  Gitlab = 'gitlab',
}

export const GITHUB_API_USING_HOST_TYPES = [
  PlatformId.Github,
  'github-releases',
  'github-tags',
  'pod',
  'github-changelog',
];

export const GITLAB_API_USING_HOST_TYPES = [
  PlatformId.Gitlab,
  'gitlab-releases',
  'gitlab-tags',
  'gitlab-packages',
  'gitlab-changelog',
  'packagist',
];

export const BITBUCKET_API_USING_HOST_TYPES = [
  PlatformId.Bitbucket,
  'bitbucket-tags',
];

export const platformHostTypes = {
  [PlatformId.Azure]: [],
  [PlatformId.Bitbucket]: BITBUCKET_API_USING_HOST_TYPES,
  [PlatformId.BitbucketServer]: [],
  [PlatformId.Gitea]: [],
  [PlatformId.Github]: GITHUB_API_USING_HOST_TYPES,
  [PlatformId.Gitlab]: GITLAB_API_USING_HOST_TYPES,
};
