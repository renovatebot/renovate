import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  dockerfileVersions: {
    description: 'Update `_VERSION` variables in Dockerfiles.',
    regexManagers: [
      {
        fileMatch: ['(^|/|\\.)Dockerfile$', '(^|/)Dockerfile[^/]*$'],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-z-]+?) depName=(?<depName>[^\\s]+?)(?: (lookupName|packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[a-z-0-9]+?))?\\s(?:ENV|ARG) .+?_VERSION[ =]"?(?<currentValue>.+?)"?\\s',
        ],
      },
    ],
  },
  githubActionsVersions: {
    description:
      'Update `_VERSION` environment variables in GitHub Action files.',
    regexManagers: [
      {
        fileMatch: ['^.github/workflows/[^\\.]+\\.ya?ml$'],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-z-]+?) depName=(?<depName>[^\\s]+?)(?: (lookupName|packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[a-z-0-9]+?))?\\s  .+?_VERSION\\s*:\\s*["\']?(?<currentValue>.+?)["\']?\\s',
        ],
      },
    ],
  },
};
