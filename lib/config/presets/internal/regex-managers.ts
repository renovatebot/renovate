import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  dockerfileVersions: {
    description: 'Update `_VERSION` variables in Dockerfiles.',
    regexManagers: [
      {
        fileMatch: [
          '(^|/|\\.)([Dd]ocker|[Cc]ontainer)file$',
          '(^|/)([Dd]ocker|[Cc]ontainer)file[^/]*$',
        ],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-z-]+?) depName=(?<depName>[^\\s]+?)(?: (lookupName|packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[^\\s]+?))?(?: registryUrl=(?<registryUrl>[^\\s]+?))?\\s(?:ENV|ARG) .+?_VERSION[ =]"?(?<currentValue>.+?)"?\\s',
        ],
      },
    ],
  },
  githubActionsVersions: {
    description:
      'Update `_VERSION` environment variables in GitHub Action files.',
    regexManagers: [
      {
        fileMatch: ['^.github/(?:workflows|actions)/.+\\.ya?ml$'],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-z-]+?) depName=(?<depName>[^\\s]+?)(?: (?:lookupName|packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[a-z-0-9]+?))?\\s+[A-Za-z0-9_]+?_VERSION\\s*:\\s*["\']?(?<currentValue>.+?)["\']?\\s',
        ],
      },
    ],
  },
  helmChartYamlAppVersions: {
    description: 'Update `appVersion` value in Helm chart `Chart.yaml`.',
    regexManagers: [
      {
        datasourceTemplate: 'docker',
        fileMatch: ['(^|/)Chart\\.yaml$'],
        matchStrings: [
          '#\\s*renovate: image=(?<depName>.*?)\\s+appVersion:\\s*["\']?(?<currentValue>[\\w+\\.\\-]*)',
        ],
      },
    ],
  },
  tfvarsVersions: {
    description: 'Update `*_version` variables in `.tfvars` files.',
    regexManagers: [
      {
        fileMatch: ['.+\\.tfvars$'],
        matchStrings: [
          '#\\s*renovate: datasource=(?<datasource>.*?) depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?\\s.*?_version\\s*=\\s*"(?<currentValue>.*)"',
        ],
        versioningTemplate: '{{#if versioning}}{{{versioning}}}{{/if}}',
      },
    ],
  },
};
