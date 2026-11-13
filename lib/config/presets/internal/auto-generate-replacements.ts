import type { PackageRule } from '../../types.ts';
import type { Preset } from '../types.ts';

export type Replacement = [string[], string];

export interface ReplacementRule {
  matchCurrentVersion?: string;
  matchDatasources: string[];
  replacements: Replacement[];
  replacementVersion?: string;
}

export interface PresetTemplate {
  title: string;
  description: string;
  packageRules: ReplacementRule[];
}

function generatePackageRules(
  replacementRules: ReplacementRule[],
): PackageRule[] {
  const rules: PackageRule[] = [];
  for (const replacementRule of replacementRules) {
    const {
      matchCurrentVersion,
      matchDatasources,
      replacements,
      replacementVersion,
    } = replacementRule;
    for (const replacement of replacements) {
      const [matchPackageNames, replacementName] = replacement;
      rules.push({
        matchCurrentVersion,
        matchDatasources,
        matchPackageNames,
        replacementName,
        replacementVersion,
      });
    }
  }
  return rules;
}

export function addPresets(
  presets: Record<string, Preset>,
  ...templates: PresetTemplate[]
): void {
  for (const template of templates) {
    const { title, description, packageRules } = template;
    presets[title] = {
      description,
      packageRules: generatePackageRules(packageRules),
    };
  }
  presets.all = {
    ...presets.all,
    extends: Object.keys(presets)
      .filter((name) => name !== 'all')
      .sort()
      .map((name) => `replacements:${name}`),
  };
}
