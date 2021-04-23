import type { Preset } from '../types';

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
