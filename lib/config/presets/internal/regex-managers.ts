import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  dockerfileVersions: {
    description: 'Update `_VERSION` variables in Dockerfiles.',
    regexManagers: [
      {
        fileMatch: ['(^|/|\\.)Dockerfile$', '(^|/)Dockerfile[^/]*$'],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-z-]+?)(?: registryUrl=(?<registryUrl>[^\\s]+?))? depName=(?<depName>[^\\s]+?)(?: (lookupName|packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[^\\s]+?))?\\s(?:ENV|ARG) .+?_VERSION[ =]"?(?<currentValue>.+?)"?\\s',
        ],
      },
    ],
  },
};
