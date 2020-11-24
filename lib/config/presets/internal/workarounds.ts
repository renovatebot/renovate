import { Preset } from '../common';

export const presets: Record<string, Preset> = {
  all: {
    description: [
      'A collection of workarounds for known problems with packages',
    ],
    extends: [
      'workarounds:unstableV2SetupNodeActions',
      'workarounds:mavenCommonsCliAncientVersion',
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
  mavenCommonsCliAncientVersion: {
    packageRules: [
      {
        datasources: ['maven'],
        packageNames: ['commons-cli:commons-cli'],
        allowedVersions: '!/20040117.000000/',
      },
    ],
  },
};
