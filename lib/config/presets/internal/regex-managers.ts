import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  dockerfileVersions: {
    description: 'Update _VERSION variables in Dockerfiles',
    regexManagers: [
      {
        fileMatch: ['(^|/|\\.)Dockerfile$', '(^|/)Dockerfile\\.[^/]*$'],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-z-]+?) depName=(?<depName>[^\\s]+?)(?: lookupName=(?<lookupName>[^\\s]+?))?(?: versioning=(?<versioning>[a-z-]+?))?\\s(?:ENV|ARG) .+?_VERSION=(?<currentValue>.+?)\\s',
        ],
      },
    ],
  },
};
