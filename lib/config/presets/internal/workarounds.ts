import { Preset } from '../common';

export const presets: Record<string, Preset> = {
  all: {
    description: [
      'A collection of workarounds for known problems with packages',
    ],
    extends: [
      'workarounds:mavenCommonsAncientVersion',
      'workarounds:ignoreSpringCloudNumeric',
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
