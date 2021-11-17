import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  all: {
    description: [
      'A collection of workarounds for known problems with packages',
    ],
    extends: [
      'workarounds:mavenCommonsAncientVersion',
      'workarounds:ignoreHttp4sDigestMilestones',
      'workarounds:ignoreSpringCloudAlphabetic',
      'workarounds:typesNodeVersioning',
      'workarounds:reduceRepologyServerLoad',
    ],
  },
  mavenCommonsAncientVersion: {
    description: 'Fix some problems with very old Maven commons versions',
    packageRules: [
      {
        matchDatasources: ['maven', 'sbt-package'],
        matchPackagePrefixes: ['commons-'],
        allowedVersions: '!/^200\\d{5}(\\.\\d+)?/',
      },
    ],
  },
  ignoreSpringCloudNumeric: {
    description:
      'DEPRECATED: Ignore old spring cloud 1.x releases, but also newer releases using Calendar Versioning.',
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
  ignoreSpringCloudAlphabetic: {
    description:
      'Ignore spring cloud releases older than the 2020 release train',
    packageRules: [
      {
        matchDatasources: ['maven'],
        matchPackageNames: [
          'org.springframework.cloud:spring-cloud-starter-parent',
        ],
        allowedVersions: '/^[0-9]/',
      },
    ],
  },
  ignoreHttp4sDigestMilestones: {
    description: 'Ignore http4s digest-based 1.x milestones',
    packageRules: [
      {
        matchManagers: ['sbt'],
        matchPackagePrefixes: ['org.http4s:'],
        allowedVersions: `!/^1\\.0-\\d+-[a-fA-F0-9]{7}$/`,
      },
    ],
  },
  typesNodeVersioning: {
    description: 'Use node versioning for @types/node',
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
      'Limit concurrent requests to reduce load on Repology servers until we can fix this properly, see issue 10133',
    hostRules: [
      {
        matchHost: 'repology.org',
        concurrentRequestLimit: 1,
      },
    ],
  },
};
