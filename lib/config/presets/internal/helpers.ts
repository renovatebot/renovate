import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  disableTypesNodeMajor: {
    description: 'Disable `major` updates to `@types/node`.',
    packageRules: [
      {
        matchPackageNames: ['@types/node'],
        matchUpdateTypes: ['major'],
        enabled: false,
      },
    ],
  },
  followTypescriptNext: {
    description: 'Keep `typescript` version in sync with the `next` tag.',
    extends: [':followTag(typescript, next)'],
  },
  followTypescriptRc: {
    description: 'Keep `typescript` version in sync with the `rc` tag.',
    extends: [':followTag(typescript, rc)'],
  },
  pinGitHubActionDigests: {
    description: 'Pin `github-action` digests.',
    packageRules: [
      {
        matchDepTypes: ['action'],
        pinDigests: true,
      },
    ],
  },
};
