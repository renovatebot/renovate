import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  disableTypesNodeMajor: {
    description: 'Disable major updates to <code>@types/node</code>',
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
      'Keep <code>typescript</code> version in sync with the <code>next</code> tag',
    extends: [':followTag(typescript, next)'],
  },
  followTypescriptRc: {
    description:
      'Keep <code>typescript</code> version in sync with the <code>rc</code> tag',
    extends: [':followTag(typescript, rc)'],
  },
  pinGitHubActionDigests: {
    description: 'Pin <code>github-action</code> digests',
    packageRules: [
      {
        matchDepTypes: ['action'],
        pinDigests: true,
      },
    ],
  },
};
