import monorepoGroups from '../../../data/monorepo.json' with { type: 'json' };
import { toArray } from '../../../util/array.ts';
import type { Preset } from '../types.ts';

export const presets: Record<string, Preset> = {};

for (const [name, value] of Object.entries(monorepoGroups.repoGroups)) {
  presets[name] = {
    description: `${name} monorepo`,
    matchSourceUrls: toArray(value),
  };
}

for (const [name, value] of Object.entries(monorepoGroups.orgGroups)) {
  presets[name] = {
    description: `${name} monorepo`,
    matchSourceUrls: toArray(value).map((url: string) => `${url}**`),
  };
}

for (const [name, value] of Object.entries(monorepoGroups.patternGroups)) {
  presets[name] = {
    description: `${name} monorepo`,
    matchPackageNames: toArray(value),
  };
}

presets.ckeditor = {
  description: 'ckeditor monorepo',
  packageRules: [
    {
      description: 'Group ckeditor5 monorepo packages by source URL.',
      matchSourceUrls: ['https://github.com/ckeditor/ckeditor5'],
    },
    {
      description:
        'Group ckeditor5-premium-features by name; it ships no repository field.',
      matchPackageNames: ['ckeditor5-premium-features'],
    },
  ],
};
