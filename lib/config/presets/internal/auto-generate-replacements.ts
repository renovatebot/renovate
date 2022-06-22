import type { PackageRule } from '../../types';
import type { Preset } from '../types';

export type Replacement = [string[], string];

export interface AutoPackageRules {
  matchCurrentVersion: string;
  matchDatasources: string[];
  replacements: Replacement[];
  replacementVersion: string;
}

export interface PresetTemplate {
  title: string;
  description: string;
  packageRules: AutoPackageRules;
}

function generatePackageRules({
  matchCurrentVersion,
  matchDatasources,
  replacements,
  replacementVersion,
}: AutoPackageRules): PackageRule[] {
  const rules: PackageRule[] = [];
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
  return rules;
}

export function addPresets(
  presets: Record<string, Preset>,
  template: PresetTemplate
): void {
  const { title, description, packageRules } = template;
  presets[title] = {
    description,
    packageRules: generatePackageRules(packageRules),
  };
  const ext = presets.all?.extends ?? [];
  ext.push(`replacements:${title}`);
  ext.sort();
}
