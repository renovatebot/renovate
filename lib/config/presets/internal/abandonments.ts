import dataFiles from '../../../data-files.generated';
import type { PackageRule } from '../../types';
import type { Preset } from '../types';

/* v8 ignore start: not testable */
function loadAbandonmentPresets(): Record<string, Preset> {
  const data: Record<string, Record<string, string>> = JSON.parse(
    dataFiles.get('data/abandonment-config.json')!,
  );
  delete data.$schema;

  const packageRules: PackageRule[] = [
    {
      matchPackageNames: ['*'],
      abandonmentThreshold: '1 year',
    },
  ];

  for (const [datasource, datasourceAbandonments] of Object.entries(data)) {
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
    recommended: { packageRules },
  };
}
/* v8 ignore stop */

export const presets: Record<string, Preset> = loadAbandonmentPresets();
