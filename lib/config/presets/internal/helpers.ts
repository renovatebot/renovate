import { Preset } from '../types';

export const presets: Record<string, Preset> = {
  disableTypesNodeMajor: {
    packageRules: [
      {
        matchPackageNames: ['@types/node'],
        matchUpdateTypes: ['major'],
        enabled: false,
      },
    ],
  },
  oddIsUnstable: {
    description: 'DEPRECATED: Odd version numbers are classified as unstable',
  },
  oddIsUnstablePackages: {
    description:
      'DEPRECATED: Preconfigure dependencies where an odd major version indicates unstable (Docker-only)',
  },
  followTypescriptNext: {
    description:
      'Keep <typescript> version in sync with the <code>next</code> tag',
    extends: [':followTag(typescript, next)'],
  },
  followTypescriptRc: {
    description:
      'Keep <typescript> version in sync with the <code>rc</code> tag',
    extends: [':followTag(typescript, rc)'],
  },
};
