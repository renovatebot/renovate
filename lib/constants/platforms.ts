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
 * The platform families Renovate can recognize from a URL.
 *
 * A family groups every flavour of one platform - the vendor's public instance
 * plus any self-hosted installation - because they share an API, a tags
 * datasource and a web UI layout.
 *
 * Every family is a `PlatformId`, but not every platform is a family:
 * `codecommit`, `gerrit`, `local` and `scm-manager` are never recognized from a
 * URL, so they have nothing to describe here.
 */
const PLATFORM_FAMILY_IDS = [
  'azure',
  'bitbucket',
  'bitbucket-server',
  'forgejo',
  'gitea',
  'github',
  'gitlab',
] as const satisfies readonly PlatformId[];

export type PlatformFamilyId = (typeof PLATFORM_FAMILY_IDS)[number];

export interface PlatformFamily {
  /**
   * `hostType` values which authenticate against this family's API, so a
   * hostRule for any of them identifies a host as belonging to the family.
   */
  apiUsingHostTypes: string[];

  /**
   * Hostnames `detectPlatform` recognizes as this family outright. Hosts which
   * are not listed are matched by its name heuristics or by a hostRule, so this
   * is a recognition list and says nothing about datasource defaults.
   */
  knownHosts: string[];

  /** Datasource which looks up git tags on this family. */
  tagsDatasource: `${PlatformFamilyId}-tags`;

  /**
   * Derives the API base URL from the web base URL, which always ends in a
   * slash. `null` for families Renovate has no API client for.
   */
  apiBaseUrl: ((baseUrl: string) => string) | null;

  /** Web UI path from a repository root to a directory at the default branch. */
  webDirPath: string;
}

/**
 * Capabilities of each platform family, so that a consumer which detected a
 * family with `detectPlatform` can look the rest up instead of carrying its own
 * mapping.
 *
 * Keys are ordered the way `detectPlatform` used to test them; both the
 * `apiUsingHostTypes` and the `knownHosts` sets are pairwise disjoint
 */
export const PLATFORM_FAMILIES = {
  azure: {
    apiUsingHostTypes: ['azure', 'azure-tags'],
    knownHosts: ['dev.azure.com'],
    tagsDatasource: 'azure-tags',
    apiBaseUrl: null,
    webDirPath: 'tree/HEAD',
  },
  'bitbucket-server': {
    apiUsingHostTypes: [
      'bitbucket-server',
      'bitbucket-server-changelog',
      'bitbucket-server-tags',
    ],
    // Bitbucket Data Center is self-hosted only.
    knownHosts: [] as string[],
    tagsDatasource: 'bitbucket-server-tags',
    apiBaseUrl: (baseUrl: string) => `${baseUrl}rest/api/1.0/`,
    webDirPath: 'browse',
  },
  bitbucket: {
    apiUsingHostTypes: ['bitbucket', 'bitbucket-changelog', 'bitbucket-tags'],
    knownHosts: ['bitbucket.org', 'bitbucket.com'],
    tagsDatasource: 'bitbucket-tags',
    // Bitbucket Cloud serves every instance from one API host.
    apiBaseUrl: (_baseUrl: string) => 'https://api.bitbucket.org/',
    webDirPath: 'src/HEAD',
  },
  forgejo: {
    apiUsingHostTypes: [
      'forgejo',
      'forgejo-changelog',
      'forgejo-releases',
      'forgejo-tags',
    ],
    knownHosts: ['codeberg.org', 'codefloe.com'],
    tagsDatasource: 'forgejo-tags',
    apiBaseUrl: (baseUrl: string) => `${baseUrl}api/v1/`,
    webDirPath: 'tree/HEAD',
  },
  gitea: {
    apiUsingHostTypes: [
      'gitea',
      'gitea-changelog',
      'gitea-releases',
      'gitea-tags',
    ],
    knownHosts: ['gitea.com'],
    tagsDatasource: 'gitea-tags',
    apiBaseUrl: (baseUrl: string) => `${baseUrl}api/v1/`,
    webDirPath: 'tree/HEAD',
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
    knownHosts: ['github.com'],
    tagsDatasource: 'github-tags',
    // Same rule as `getApiBaseUrl`, @see lib/util/github/url.ts. That helper is
    // not reused here because `lib/constants` imports nothing, and because it
    // also normalizes URLs which already carry an API path, which a base URL
    // built from a `protocol//host/` pair never does.
    apiBaseUrl: (baseUrl: string) =>
      baseUrl.startsWith('https://github.com/')
        ? 'https://api.github.com/'
        : `${baseUrl}api/v3/`,
    webDirPath: 'tree/HEAD',
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
    knownHosts: ['gitlab.com'],
    tagsDatasource: 'gitlab-tags',
    apiBaseUrl: (baseUrl: string) => `${baseUrl}api/v4/`,
    webDirPath: 'tree/HEAD',
  },
} satisfies Record<PlatformFamilyId, PlatformFamily>;
