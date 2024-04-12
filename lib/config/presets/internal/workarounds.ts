import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  all: {
    description: [
      'Apply crowd-sourced workarounds for known problems with packages.',
    ],
    extends: [
      'workarounds:mavenCommonsAncientVersion',
      'workarounds:ignoreSpringCloudNumeric',
      'workarounds:ignoreWeb3jCoreWithOldReleaseTimestamp',
      'workarounds:ignoreHttp4sDigestMilestones',
      'workarounds:typesNodeVersioning',
      'workarounds:nodeDockerVersioning',
      'workarounds:reduceRepologyServerLoad',
      'workarounds:doNotUpgradeFromAlpineStableToEdge',
      'workarounds:supportRedHatImageVersion',
      'workarounds:javaLTSVersions',
      'workarounds:disableEclipseLifecycleMapping',
      'workarounds:disableMavenParentRoot',
      'workarounds:containerbase',
    ],
    ignoreDeps: [], // Hack to improve onboarding PR description
  },
  containerbase: {
    description: 'Add some containerbase overrides.',
    packageRules: [
      {
        description:
          'Use node versioning for `(containerbase|renovate)/node` images',
        matchDatasources: ['docker'],
        matchPackagePatterns: [
          '^(?:(?:docker|ghcr)\\.io/)?(?:containerbase|renovate)/node$',
        ],
        versioning: 'node',
      },
    ],
  },
  disableEclipseLifecycleMapping: {
    description: 'Disable Eclipse m2e lifecycle-mapping placeholder package.',
    packageRules: [
      {
        enabled: false,
        matchDatasources: ['maven'],
        matchPackageNames: ['org.eclipse.m2e:lifecycle-mapping'],
      },
    ],
  },
  disableMavenParentRoot: {
    description:
      'Avoid version fetching for Maven packages detected as project root.',
    packageRules: [
      {
        enabled: false,
        matchDepTypes: ['parent-root'],
        matchManagers: ['maven'],
      },
    ],
  },
  doNotUpgradeFromAlpineStableToEdge: {
    description: 'Do not upgrade from Alpine stable to edge.',
    packageRules: [
      {
        allowedVersions: '<20000000',
        matchCurrentVersion: '!/^\\d{8}$/',
        matchDatasources: ['docker'],
        matchPackageNames: ['alpine'],
      },
    ],
  },
  ignoreHttp4sDigestMilestones: {
    description: 'Ignore `http4s` digest-based `1.x` milestones.',
    packageRules: [
      {
        allowedVersions: `!/^1\\.0-\\d+-[a-fA-F0-9]{7}$/`,
        matchManagers: ['sbt'],
        matchPackagePrefixes: ['org.http4s:'],
      },
    ],
  },
  ignoreSpringCloudNumeric: {
    description: 'Ignore spring cloud `1.x` releases.',
    packageRules: [
      {
        allowedVersions: '/^[A-Z]/',
        matchDatasources: ['maven'],
        matchPackageNames: [
          'org.springframework.cloud:spring-cloud-starter-parent',
        ],
      },
    ],
  },
  ignoreWeb3jCoreWithOldReleaseTimestamp: {
    description: 'Ignore `web3j` `5.0.0` release.',
    packageRules: [
      {
        allowedVersions: '!/^5\\.0\\.0/',
        matchDatasources: ['maven'],
        matchPackageNames: ['org.web3j:core'],
      },
    ],
  },
  javaLTSVersions: {
    description: 'Limit Java runtime versions to LTS releases.',
    packageRules: [
      {
        allowedVersions: '/^(?:8|11|17|21)(?:\\.|-|$)/',
        description:
          'Limit Java runtime versions to LTS releases. To receive all major releases add `workarounds:javaLTSVersions` to the `ignorePresets` array.',
        matchDatasources: ['docker', 'java-version'],
        matchPackageNames: [
          'eclipse-temurin',
          'amazoncorretto',
          'adoptopenjdk',
          'openjdk',
          'java',
          'java-jre',
          'sapmachine',
        ],
        matchPackagePatterns: [
          '^azul/zulu-openjdk',
          '^bellsoft/liberica-openj(dk|re)-',
          '^cimg/openjdk',
        ],
        versioning:
          'regex:^(?<major>\\d+)?(\\.(?<minor>\\d+))?(\\.(?<patch>\\d+))?([\\._+](?<build>(\\d\\.?)+)(LTS)?)?(-(?<compatibility>.*))?$',
      },
    ],
  },
  mavenCommonsAncientVersion: {
    description: 'Fix some problems with very old Maven commons versions.',
    packageRules: [
      {
        allowedVersions: '!/^200\\d{5}(\\.\\d+)?/',
        matchDatasources: ['maven', 'sbt-package'],
        matchPackagePrefixes: ['commons-'],
      },
    ],
  },
  nodeDockerVersioning: {
    description: 'Use node versioning for `node` docker images.',
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchDepNames: ['node'],
        versionCompatibility: '^(?<version>[^-]+)(?<compatibility>-.*)?$',
        versioning: 'node',
      },
    ],
  },
  reduceRepologyServerLoad: {
    description:
      'Limit requests to reduce load on Repology servers until we can fix this properly, see issue `#10133`.',
    hostRules: [
      {
        concurrentRequestLimit: 1,
        matchHost: 'repology.org',
        maxRequestsPerSecond: 0.5,
      },
    ],
  },
  supportRedHatImageVersion: {
    description:
      'Use specific versioning for Red Hat-maintained container images.',
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchPackageNames: [
          'registry.access.redhat.com/rhel',
          'registry.access.redhat.com/rhel-atomic',
          'registry.access.redhat.com/rhel-init',
          'registry.access.redhat.com/rhel-minimal',
        ],
        matchPackagePrefixes: [
          'registry.access.redhat.com/rhceph/',
          'registry.access.redhat.com/rhgs3/',
          'registry.access.redhat.com/rhel7',
          'registry.access.redhat.com/rhel8/',
          'registry.access.redhat.com/rhel9/',
          'registry.access.redhat.com/rhscl/',
          'registry.access.redhat.com/ubi7',
          'registry.access.redhat.com/ubi8',
          'registry.access.redhat.com/ubi9',
          'redhat/',
        ],
        versioning: 'redhat',
      },
    ],
  },
  typesNodeVersioning: {
    description: 'Use node versioning for `@types/node`.',
    packageRules: [
      {
        matchManagers: ['npm'],
        matchPackageNames: ['@types/node'],
        versioning: `node`,
      },
    ],
  },
};
