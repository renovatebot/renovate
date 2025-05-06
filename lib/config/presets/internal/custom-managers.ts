import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  azurePipelinesVersions: {
    customManagers: [
      {
        customType: 'regex',
        managerFilePatterns: [
          '/(^|/).azuredevops/.+\\.ya?ml$/',
          '/azure.*pipelines?.*\\.ya?ml$/',
        ],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-zA-Z0-9-._]+?) depName=(?<depName>[^\\s]+?)(?: (?:lookupName|packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[^\\s]+?))?(?: extractVersion=(?<extractVersion>[^\\s]+?))?\\s+[A-Za-z0-9_]+?_VERSION\\s*:\\s*["\']?(?<currentValue>.+?)["\']?\\s',
        ],
      },
    ],
    description:
      'Update `_VERSION` environment variables in Azure Pipelines files.',
  },
  biomeVersions: {
    customManagers: [
      {
        customType: 'jsonata',
        datasourceTemplate: 'npm',
        depNameTemplate: '@biomejs/biome',
        fileFormat: 'json',
        managerFilePatterns: ['/(^|/)biome.jsonc?$/'],
        matchStrings: ['{"currentValue": $split($."$schema",("/"))[-2]}'],
      },
    ],
    description:
      'Update `$schema` version in `biome.json` configuration files.',
  },
  bitbucketPipelinesVersions: {
    customManagers: [
      {
        customType: 'regex',
        managerFilePatterns: ['/(^|/)bitbucket-pipelines\\.ya?ml$/'],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-zA-Z0-9-._]+?) depName=(?<depName>[^\\s]+?)(?: (lookupName|packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[^\\s]+?))?(?: extractVersion=(?<extractVersion>[^\\s]+?))?(?: registryUrl=(?<registryUrl>[^\\s]+?))?\\s+.*\\s+[A-Za-z0-9_]+?_VERSION[ =:]\\s?["\']?(?<currentValue>.+?)["\']?\\s',
        ],
      },
    ],
    description: 'Update `_VERSION` variables in Bitbucket Pipelines',
  },
  dockerfileVersions: {
    customManagers: [
      {
        customType: 'regex',
        managerFilePatterns: [
          '/(^|/|\\.)([Dd]ocker|[Cc]ontainer)file$/',
          '/(^|/)([Dd]ocker|[Cc]ontainer)file[^/]*$/',
        ],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-zA-Z0-9-._]+?) depName=(?<depName>[^\\s]+?)(?: (lookupName|packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[^\\s]+?))?(?: extractVersion=(?<extractVersion>[^\\s]+?))?(?: registryUrl=(?<registryUrl>[^\\s]+?))?\\s(?:ENV|ARG)\\s+[A-Za-z0-9_]+?_VERSION[ =]["\']?(?<currentValue>.+?)["\']?\\s',
        ],
      },
    ],
    description: 'Update `_VERSION` variables in Dockerfiles.',
  },
  githubActionsVersions: {
    customManagers: [
      {
        customType: 'regex',
        managerFilePatterns: [
          '/(^|/)(workflow-templates|\\.(?:github|gitea|forgejo)/(?:workflows|actions))/.+\\.ya?ml$/',
          '/(^|/)action\\.ya?ml$/',
        ],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-zA-Z0-9-._]+?) depName=(?<depName>[^\\s]+?)(?: (?:lookupName|packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[^\\s]+?))?(?: extractVersion=(?<extractVersion>[^\\s]+?))?\\s+[A-Za-z0-9_]+?_VERSION\\s*:\\s*["\']?(?<currentValue>.+?)["\']?\\s',
        ],
      },
    ],
    description:
      'Update `_VERSION` environment variables in GitHub Action files.',
  },
  gitlabPipelineVersions: {
    customManagers: [
      {
        customType: 'regex',
        managerFilePatterns: ['/\\.gitlab-ci\\.ya?ml$/'],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-zA-Z0-9-._]+?) depName=(?<depName>[^\\s]+?)(?: (?:packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[^\\s]+?))?(?: extractVersion=(?<extractVersion>[^\\s]+?))?(?: registryUrl=(?<registryUrl>[^\\s]+?))?\\s+[A-Za-z0-9_]+?_VERSION\\s*:\\s*["\']?(?<currentValue>.+?)["\']?\\s',
        ],
      },
    ],
    description:
      'Update `_VERSION` environment variables in GitLab pipeline file.',
  },
  helmChartYamlAppVersions: {
    customManagers: [
      {
        customType: 'regex',
        datasourceTemplate: 'docker',
        managerFilePatterns: ['/(^|/)Chart\\.yaml$/'],
        matchStrings: [
          '#\\s*renovate: image=(?<depName>.*?)\\s+appVersion:\\s*["\']?(?<currentValue>[\\w+\\.\\-]*)',
        ],
      },
    ],
    description: 'Update `appVersion` value in Helm chart `Chart.yaml`.',
  },
  makefileVersions: {
    customManagers: [
      {
        customType: 'regex',
        managerFilePatterns: [
          '/(^|/)Makefile$/',
          '/(^|/)makefile$/',
          '/(^|/)GNUMakefile$/',
          '/\\.mk$/',
        ],
        matchStrings: [
          '# renovate: datasource=(?<datasource>[a-zA-Z0-9-._]+?) depName=(?<depName>[^\\s]+?)(?: (?:packageName)=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[^\\s]+?))?(?: extractVersion=(?<extractVersion>[^\\s]+?))?(?: registryUrl=(?<registryUrl>[^\\s]+?))?\\s+[A-Za-z0-9_]+?_VERSION\\s*:*\\??=\\s*["\']?(?<currentValue>.+?)["\']?\\s',
        ],
      },
    ],
    description: 'Update `_VERSION` variables in Makefiles.',
  },
  mavenPropertyVersions: {
    customManagers: [
      {
        customType: 'regex',
        datasourceTemplate:
          '{{#if datasource}}{{{datasource}}}{{else}}maven{{/if}}',
        managerFilePatterns: ['/(^|/)pom\\.xml$/'],
        matchStrings: [
          '<!--\\s?renovate:( datasource=(?<datasource>[a-zA-Z0-9-._]+?))? depName=(?<depName>[^\\s]+?)(?: packageName=(?<packageName>[^\\s]+?))?(?: versioning=(?<versioning>[^\\s]+?))?(?: extractVersion=(?<extractVersion>[^\\s]+?))?\\s+-->\\s+<.+\\.version>(?<currentValue>.+)<\\/.+\\.version>',
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
        managerFilePatterns: ['/.+\\.tfvars$/'],
        matchStrings: [
          '#\\s*renovate: datasource=(?<datasource>.*?) depName=(?<depName>.*?)( versioning=(?<versioning>.*?))?(?: extractVersion=(?<extractVersion>.*?))?\\s.*?_version\\s*=\\s*"(?<currentValue>.*)"',
        ],
        versioningTemplate: '{{#if versioning}}{{{versioning}}}{{/if}}',
      },
    ],
    description: 'Update `*_version` variables in `.tfvars` files.',
  },
};
