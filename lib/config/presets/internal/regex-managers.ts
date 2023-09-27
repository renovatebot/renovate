import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  dockerfileVersions: {
    customManagers: [
      {
        customType: 'regex',
        fileMatch: [
          '(^|/|\\.)([Dd]ocker|[Cc]ontainer)file$',
          '(^|/)([Dd]ocker|[Cc]ontainer)file[^/]*$',
        ],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-z-.]+?) depName=(?<depName>[^\\s]+?)(?: (lookupName|packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[^\\s]+?))?(?: registryUrl=(?<registryUrl>[^\\s]+?))?\\s(?:ENV|ARG) .+?_VERSION[ =]"?(?<currentValue>.+?)"?\\s',
        ],
      },
    ],
    description: 'Update `_VERSION` variables in Dockerfiles.',
  },
  githubActionsVersions: {
    customManagers: [
      {
        customType: 'regex',
        fileMatch: ['^.github/(?:workflows|actions)/.+\\.ya?ml$'],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-z-.]+?) depName=(?<depName>[^\\s]+?)(?: (?:lookupName|packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[a-z-0-9]+?))?\\s+[A-Za-z0-9_]+?_VERSION\\s*:\\s*["\']?(?<currentValue>.+?)["\']?\\s',
        ],
      },
    ],
    description:
      'Update `_VERSION` environment variables in GitHub Action files.',
  },
  helmChartYamlAppVersions: {
    customManagers: [
      {
        customType: 'regex',
        datasourceTemplate: 'docker',
        fileMatch: ['(^|/)Chart\\.yaml$'],
        matchStrings: [
          '#\\s*renovate: image=(?<depName>.*?)\\s+appVersion:\\s*["\']?(?<currentValue>[\\w+\\.\\-]*)',
        ],
      },
    ],
    description: 'Update `appVersion` value in Helm chart `Chart.yaml`.',
  },
  mavenPropertyVersions: {
    customManagers: [
      {
        customType: 'regex',
        datasourceTemplate:
          '{{#if datasource}}{{{datasource}}}{{else}}maven{{/if}}',
        fileMatch: ['(^|/)pom\\.xml$'],
        matchStrings: [
          '<!--\\s?renovate:( datasource=(?<datasource>[a-z-.]+?))? depName=(?<depName>[^\\s]+?)(?: packageName=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[a-z-0-9]+?))?\\s+-->\\s+<.+\\.version>(?<currentValue>.+)<\\/.+\\.version>',
        ],
        versioningTemplate: '{{#if versioning}}{{{versioning}}}{{/if}}',
      },
    ],
    description: 'Update `*.version` properties in `pom.xml` files.',
  },
  tfvarsVersions: {
    customManagers: [
      {
        customType: 'regex',
        fileMatch: ['.+\\.tfvars$'],
        matchStrings: [
          '#\\s*renovate: datasource=(?<datasource>.*?) depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?\\s.*?_version\\s*=\\s*"(?<currentValue>.*)"',
        ],
        versioningTemplate: '{{#if versioning}}{{{versioning}}}{{/if}}',
      },
    ],
    description: 'Update `*_version` variables in `.tfvars` files.',
  },
};
