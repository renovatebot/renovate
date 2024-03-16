import type { Contents, HelmChartContent } from './types';

export function isHelmChart(item: Contents): item is HelmChartContent {
  return 'helmChart' in item;
}
