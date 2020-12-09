import { Preset } from '../common';

export const presets: Record<string, Preset> = {
  all: {
    description: [
      'A collection of workarounds for known problems with packages',
    ],
    extends: [
      'workarounds:unstableV2SetupNodeActions',
      'workarounds:mavenCommonsAncientVersion',
      'workarounds:ignoreSpringCloudNumeric',
    ],
  },
  unstableV2SetupNodeActions: {
    description: 'Ignore wrongly tagged actions/setup-node v2 releases',
    packageRules: [
      {
        datasources: ['github-tags', 'github-releases'],
        packageNames: ['actions/setup-node'],
        allowedVersions: '<2.1.1 || > 2.1.1',
      },
    ],
  },
  mavenCommonsAncientVersion: {
    packageRules: [
      {
        datasources: ['maven', 'sbt-package'],
        packagePatterns: ['^commons-'],
        allowedVersions: '!/^200\\d{5}(\\.\\d+)?/',
      },
    ],
  },
  ignoreSpringCloudNumeric: {
    description: 'Ignore spring cloud 1.x releases',
    packageRules: [
      {
        datasources: ['maven'],
        packageNames: ['org.springframework.cloud:spring-cloud-starter-parent'],
        allowedVersions: '/^[A-Z]/',
      },
    ],
  },
};
