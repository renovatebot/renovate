import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  all: {
    description: [
      'A collection of workarounds for known problems with packages',
    ],
    extends: [
      'workarounds:mavenCommonsAncientVersion',
      'workarounds:ignoreSpringCloudNumeric',
      'workarounds:ignoreWeb3jCoreWithOldReleaseTimestamp',
      'workarounds:ignoreHttp4sDigestMilestones',
      'workarounds:typesNodeVersioning',
      'workarounds:reduceRepologyServerLoad',
      'workarounds:doNotUpgradeFromAlpineStableToEdge',
      'workarounds:ignoreDotnet7Preview',
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
  ignoreWeb3jCoreWithOldReleaseTimestamp: {
    description: 'Ignore web3j 5.0.0 release',
    packageRules: [
      {
        matchDatasources: ['maven'],
        matchPackageNames: ['org.web3j:core'],
        allowedVersions: '!/^5\\.0\\.0/',
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
  doNotUpgradeFromAlpineStableToEdge: {
    description: 'Do not upgrade from Alpine stable to edge',
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchPackageNames: ['alpine'],
        matchCurrentVersion: '<20000000',
        allowedVersions: '<20000000',
      },
    ],
  },
  ignoreDotnet7Preview: {
    description: 'Ignore dotnet 7 preview releases',
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchPackagePrefixes: ['mcr.microsoft.com/dotnet/'],
        allowedVersions: '!/^7\\.0/',
      },
    ],
  },
};
