import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  all: {
    description: [
      'A collection of workarounds for known problems with packages',
    ],
    extends: [
      'workarounds:mavenCommonsAncientVersion',
      'workarounds:ignoreSpringCloudNumeric',
      'workarounds:ignoreHttp4sDigestMilestones',
      'workarounds:typesNodeVersioning',
      'workarounds:reduceRepologyServerLoad',
    ],
  },
  mavenCommonsAncientVersion: {
    packageRules: [
      {
        matchDatasources: ['maven', 'sbt-package'],
        matchPackagePrefixes: ['commons-'],
        allowedVersions: '!/^200\\d{5}(\\.\\d+)?/',
      },
    ],
  },
  ignoreSpringCloudNumeric: {
    description: 'Ignore spring cloud 1.x releases',
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
