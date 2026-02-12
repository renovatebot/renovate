import data from '../../../data/abandonments.json' with { type: 'json' };
import type { PackageRule } from '../../types.ts';
import type { Preset } from '../types.ts';

function loadAbandonmentPresets(): Record<string, Preset> {
  const packageRules: PackageRule[] = [
    {
      abandonmentThreshold: '1 year',
      matchPackageNames: ['*'],
    },
  ];

  for (const [datasource, datasourceAbandonments] of Object.entries(data)) {
    if (datasource === '$schema') {
      continue;
    }

    for (const [packageName, threshold] of Object.entries(
      datasourceAbandonments,
    )) {
      const abandonmentThreshold = threshold === 'eternal' ? null : threshold;
      packageRules.push({
        abandonmentThreshold,
        matchDatasources: [datasource],
        matchPackageNames: [packageName],
      });
    }
  }

  return {
    recommended: {
      description:
        'Recommended configuration for abandoned packages, treating packages without a release for 1 year as abandoned, while taking into account community-sourced overrides.',
      packageRules,
    },
  };
}

export const presets: Record<string, Preset> = loadAbandonmentPresets();
