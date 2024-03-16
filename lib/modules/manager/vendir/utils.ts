import type { Contents, HelmChartContent, Repository } from './types';

export function isHelmChart(item: Contents): item is HelmChartContent {
  return 'helmChart' in item;
}
