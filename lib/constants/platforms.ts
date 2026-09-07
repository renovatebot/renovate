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
  'scm-manager',
] as const;

export type PlatformId = (typeof PLATFORM_HOST_TYPES)[number];

/**
 * The git host families Renovate can recognize from a URL.
 *
 * A family groups every flavour of one git host - the vendor's public instance
 * plus any self-hosted installation - because they share an API, a tags
 * datasource and a web UI layout.
 */
export type GitHostFamilyId =
  | 'azure'
  | 'bitbucket'
  | 'bitbucket-server'
  | 'forgejo'
  | 'gitea'
  | 'github'
  | 'gitlab';

export interface GitHostFamily {
  /**
   * `hostType` values which authenticate against this family's API, so a
   * hostRule for any of them identifies a host as belonging to the family.
   */
  apiUsingHostTypes: string[];

  /**
   * Hostnames of the vendor-run instances of this family. A datasource already
   * defaults to these, so a dependency on one needs no `registryUrls`.
   */
  publicHosts: string[];

  /** Datasource which looks up git tags on this family. */
  tagsDatasource: string;

  /**
   * Derives the API base URL from the web base URL (which always ends in a
   * slash). `null` for families Renovate has no API client for.
   */
  apiBaseUrl: ((baseUrl: string) => string) | null;

  /** Web UI path from a repository root to a directory at the default branch. */
  webDirPath: string;

  /** Web UI path from a repository root to a file at the default branch. */
  webFilePath: string;
}

/**
 * Capabilities of each git host family, so that a consumer which detected a
 * family with `detectPlatform` can look the rest up instead of carrying its own
 * mapping.
 *
 * Keys are ordered the way `detectPlatform` used to test them; the
 * `apiUsingHostTypes` sets are pairwise disjoint, so the order is not load
 * bearing.
 */
export const GIT_HOST_FAMILIES = {
  azure: {
    apiUsingHostTypes: ['azure', 'azure-tags'],
    publicHosts: ['dev.azure.com'],
    tagsDatasource: 'azure-tags',
    apiBaseUrl: null,
    webDirPath: 'tree/HEAD',
    webFilePath: 'blob/HEAD',
  },
  'bitbucket-server': {
    apiUsingHostTypes: [
      'bitbucket-server',
      'bitbucket-server-changelog',
      'bitbucket-server-tags',
    ],
    // Bitbucket Data Center is self-hosted only.
    publicHosts: [] as string[],
    tagsDatasource: 'bitbucket-server-tags',
    apiBaseUrl: (baseUrl: string) => `${baseUrl}rest/api/1.0/`,
    webDirPath: 'browse',
    webFilePath: 'browse',
  },
  bitbucket: {
    apiUsingHostTypes: ['bitbucket', 'bitbucket-changelog', 'bitbucket-tags'],
    publicHosts: ['bitbucket.org', 'bitbucket.com'],
    tagsDatasource: 'bitbucket-tags',
    // Bitbucket Cloud serves every instance from one API host.
    apiBaseUrl: (_baseUrl: string) => 'https://api.bitbucket.org/',
    webDirPath: 'src/HEAD',
    webFilePath: 'src/HEAD',
  },
  forgejo: {
    apiUsingHostTypes: [
      'forgejo',
      'forgejo-changelog',
      'forgejo-releases',
      'forgejo-tags',
    ],
    publicHosts: ['codeberg.org', 'codefloe.com'],
    tagsDatasource: 'forgejo-tags',
    apiBaseUrl: (baseUrl: string) => `${baseUrl}api/v1/`,
    webDirPath: 'tree/HEAD',
    webFilePath: 'blob/HEAD',
  },
  gitea: {
    apiUsingHostTypes: [
      'gitea',
      'gitea-changelog',
      'gitea-releases',
      'gitea-tags',
    ],
    publicHosts: ['gitea.com'],
    tagsDatasource: 'gitea-tags',
    apiBaseUrl: (baseUrl: string) => `${baseUrl}api/v1/`,
    webDirPath: 'tree/HEAD',
    webFilePath: 'blob/HEAD',
  },
  github: {
    apiUsingHostTypes: [
      'github',
      'github-releases',
      'github-release-attachments',
      'github-tags',
      'pod',
      'hermit',
      'github-changelog',
      'conan',
      // DEPRECATED: do not add additional datasource-specific entries here, if they use `api.github.com` to look up new versions
    ],
    publicHosts: ['github.com'],
    tagsDatasource: 'github-tags',
    apiBaseUrl: (baseUrl: string) =>
      baseUrl.startsWith('https://github.com/')
        ? 'https://api.github.com/'
        : `${baseUrl}api/v3/`,
    webDirPath: 'tree/HEAD',
    webFilePath: 'blob/HEAD',
  },
  gitlab: {
    apiUsingHostTypes: [
      'gitlab',
      'gitlab-releases',
      'gitlab-tags',
      'gitlab-packages',
      'gitlab-changelog',
      'pypi',
    ],
    publicHosts: ['gitlab.com'],
    tagsDatasource: 'gitlab-tags',
    apiBaseUrl: (baseUrl: string) => `${baseUrl}api/v4/`,
    webDirPath: 'tree/HEAD',
    webFilePath: 'blob/HEAD',
  },
} satisfies Record<GitHostFamilyId, GitHostFamily>;

export const AZURE_API_USING_HOST_TYPES =
  GIT_HOST_FAMILIES.azure.apiUsingHostTypes;

export const GITEA_API_USING_HOST_TYPES =
  GIT_HOST_FAMILIES.gitea.apiUsingHostTypes;

export const FORGEJO_API_USING_HOST_TYPES =
  GIT_HOST_FAMILIES.forgejo.apiUsingHostTypes;

export const GITHUB_API_USING_HOST_TYPES =
  GIT_HOST_FAMILIES.github.apiUsingHostTypes;

export const GITLAB_API_USING_HOST_TYPES =
  GIT_HOST_FAMILIES.gitlab.apiUsingHostTypes;

export const BITBUCKET_API_USING_HOST_TYPES =
  GIT_HOST_FAMILIES.bitbucket.apiUsingHostTypes;

export const BITBUCKET_SERVER_API_USING_HOST_TYPES =
  GIT_HOST_FAMILIES['bitbucket-server'].apiUsingHostTypes;
