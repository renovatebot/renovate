import monorepoGroups from '../../../data/monorepo.json';
import { toArray } from '../../../util/array';
import type { Preset } from '../types';

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
