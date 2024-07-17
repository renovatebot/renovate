import fs from 'node:fs/promises';
import { toArray } from '../../../util/array';
import type { Preset } from '../types';

async function getMonorepoPresets(): Promise<Record<string, Preset>> {
  const presets: Record<string, Preset> = {};
  const groups = JSON.parse(
    await fs.readFile('lib/data/monorepo.json', 'utf8'),
  );

  for (const [name, value] of Object.entries(groups.repoGroups ?? {})) {
    presets[name] = {
      description: `${name} monorepo`,
      matchSourceUrls: toArray(value),
    };
  }

  for (const [name, value] of Object.entries(groups.orgGroups ?? {})) {
    presets[name] = {
      description: `${name} monorepo`,
      matchSourceUrlPrefixes: toArray(value),
    };
  }

  for (const [name, value] of Object.entries(groups.patternGroups ?? {})) {
    presets[name] = {
      description: `${name} monorepo`,
      matchPackagePatterns: toArray(value),
    };
  }

  return presets;
}

export const presets = getMonorepoPresets();
