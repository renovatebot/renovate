export const PLATFORM_HOST_TYPES = [
  'azure',
  'bitbucket',
  'bitbucket-server',
  'codecommit',
  'forgejo',
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

export const FORGEJO_API_USING_HOST_TYPES = [
  'forgejo',
  'forgejo-changelog',
  'forgejo-releases',
  'forgejo-tags',
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

export const AZURE_POLICY_TYPES = {
  RequiredReviewers: 'fd2167ab-b0be-447a-8ec8-39368250530e',
  RequireAMergeStrategy: 'fa4e907d-c16b-4a4c-9dfa-4916e5d171ab',
  MinimumNumberOfReviewers: 'fa4e907d-c16b-4a4c-9dfa-4906e5d171dd',
  Build: '0609b952-1397-4640-95ec-e00a01b2c241',
  WorkItemLinking: '40e92b44-2fe1-4dd6-b3d8-74a9c21d0c6e',
} as const;

export type AzurePolicyTypeUuid =
  (typeof AZURE_POLICY_TYPES)[keyof typeof AZURE_POLICY_TYPES];

export type AzurePolicyType =
  | keyof typeof AZURE_POLICY_TYPES
  | AzurePolicyTypeUuid;
