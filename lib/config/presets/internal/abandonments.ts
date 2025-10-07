import data from '../../../data/abandonments.json';
import type { PackageRule } from '../../types';
import type { Preset } from '../types';

function loadAbandonmentPresets(): Record<string, Preset> {
  const packageRules: PackageRule[] = [
    {
      matchPackageNames: ['*'],
      abandonmentThreshold: '1 year',
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
        matchDatasources: [datasource],
        matchPackageNames: [packageName],
        abandonmentThreshold,
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
