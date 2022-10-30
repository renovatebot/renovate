import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  all: {
    description: [
      'A collection of workarounds for known problems with packages.',
    ],
    extends: [
      'workarounds:mavenCommonsAncientVersion',
      'workarounds:ignoreSpringCloudNumeric',
      'workarounds:ignoreWeb3jCoreWithOldReleaseTimestamp',
      'workarounds:ignoreHttp4sDigestMilestones',
      'workarounds:typesNodeVersioning',
      'workarounds:reduceRepologyServerLoad',
      'workarounds:doNotUpgradeFromAlpineStableToEdge',
      'workarounds:supportRedHatImageVersion',
      'workarounds:javaLTSVersions',
    ],
    ignoreDeps: [],
  },
  mavenCommonsAncientVersion: {
    description: 'Fix some problems with very old Maven commons versions.',
    packageRules: [
      {
        matchDatasources: ['maven', 'sbt-package'],
        matchPackagePrefixes: ['commons-'],
        allowedVersions: '!/^200\\d{5}(\\.\\d+)?/',
      },
    ],
  },
  ignoreSpringCloudNumeric: {
    description: 'Ignore spring cloud `1.x` releases.',
    packageRules: [
      {
        matchDatasources: ['maven'],
        matchPackageNames: [
          'org.springframework.cloud:spring-cloud-starter-parent',
        ],
        allowedVersions: '/^[A-Z]/',
      },
    ],
  },
  ignoreWeb3jCoreWithOldReleaseTimestamp: {
    description: 'Ignore `web3j` `5.0.0` release.',
    packageRules: [
      {
        matchDatasources: ['maven'],
        matchPackageNames: ['org.web3j:core'],
        allowedVersions: '!/^5\\.0\\.0/',
      },
    ],
  },
  ignoreHttp4sDigestMilestones: {
    description: 'Ignore `http4s` digest-based `1.x` milestones.',
    packageRules: [
      {
        matchManagers: ['sbt'],
        matchPackagePrefixes: ['org.http4s:'],
        allowedVersions: `!/^1\\.0-\\d+-[a-fA-F0-9]{7}$/`,
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
  reduceRepologyServerLoad: {
    description:
      'Limit concurrent requests to reduce load on Repology servers until we can fix this properly, see issue `#10133`.',
    hostRules: [
      {
        matchHost: 'repology.org',
        concurrentRequestLimit: 1,
      },
    ],
  },
  doNotUpgradeFromAlpineStableToEdge: {
    description: 'Do not upgrade from Alpine stable to edge.',
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchPackageNames: ['alpine'],
        matchCurrentVersion: '<20000000',
        allowedVersions: '<20000000',
      },
    ],
  },
  supportRedHatImageVersion: {
    description:
      'Use specific versioning for Red Hat-maintained container images',
    packageRules: [
      {
        matchDatasources: ['docker'],
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
        matchPackageNames: [
          'registry.access.redhat.com/rhel',
          'registry.access.redhat.com/rhel-atomic',
          'registry.access.redhat.com/rhel-init',
          'registry.access.redhat.com/rhel-minimal',
        ],
        versioning: 'redhat',
      },
    ],
  },
  javaLTSVersions: {
    description: 'Limit Java runtime versions to LTS releases',
    packageRules: [
      {
        description:
          'Limit Java runtime versions to LTS releases. To receive all major releases add `workarounds:javaLTSVersions` to the `ignorePresets` array.',
        matchDatasources: ['docker', 'adoptium-java'],
        matchPackageNames: [
          'eclipse-temurin',
          'amazoncorretto',
          'adoptopenjdk',
          'openjdk',
          'java',
          'java-jre',
          'sapmachine',
        ],
        versioning:
          'regex:^(?<major>\\d+)?(\\.(?<minor>\\d+))?(\\.(?<patch>\\d+))?([\\._+](?<build>\\d+))?(-(?<compatibility>.*))?$',
        allowedVersions: '/^(?:8|11|17|21|25|29)(?:\\.|$)/',
      },
    ],
  },
};
