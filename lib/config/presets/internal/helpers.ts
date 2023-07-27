import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  disableTypesNodeMajor: {
    description: 'Disable `major` updates to `@types/node`.',
    packageRules: [
      {
        enabled: false,
        matchPackageNames: ['@types/node'],
        matchUpdateTypes: ['major'],
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
    description: 'Pin `github-action` digests.\n In case you use `vX` pins and you\'d like not only pin digests but specify which exact tag is used by changing `vX` to `vX.Y.Z` - except enabling this preset, add to your config [this workaround](https://github.com/renovatebot/.github/blob/f5a5fc056c78fe7741a4fde59ee94feed622cd3e/default.json#L45-L50).',
    packageRules: [
      {
        matchDepTypes: ['action'],
        pinDigests: true,
      },
    ],
  },
};
