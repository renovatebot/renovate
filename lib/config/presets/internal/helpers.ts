import { _ } from '../../../i18n';
import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  disableTypesNodeMajor: {
    description: _('Disable `major` updates to `@types/node`.'),
    packageRules: [
      {
        enabled: false,
        matchPackageNames: ['@types/node'],
        matchUpdateTypes: ['major'],
      },
    ],
  },
  followTypescriptNext: {
    description: _('Keep `typescript` version in sync with the `next` tag.'),
    extends: [':followTag(typescript, next)'],
  },
  followTypescriptRc: {
    description: _('Keep `typescript` version in sync with the `rc` tag.'),
    extends: [':followTag(typescript, rc)'],
  },
  pinGitHubActionDigests: {
    description: _('Pin `github-action` digests.'),
    packageRules: [
      {
        matchDepTypes: ['action'],
        pinDigests: true,
      },
    ],
  },
};
