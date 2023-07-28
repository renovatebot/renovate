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
    description: 'Pin `github-action` digests.\n In case you use `vX` pins and you\'d like not only pin digests but specify which exact tag is used by changing `vX` to `vX.Y.Z` - except enabling this preset, add to your config [this workaround](https://github.com/renovatebot/renovate/discussions/21901#discussioncomment-6563510).',
    packageRules: [
      {
        matchDepTypes: ['action'],
        pinDigests: true,
      },
    ],
  },
};
