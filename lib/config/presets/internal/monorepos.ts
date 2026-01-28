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
