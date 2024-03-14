import type { Contents, HelmChartContent, Repository } from './types';

export function isHelmChart(item: Contents): item is HelmChartContent {
  return 'helmChart' in item;
}

export function isOCIRegistry(repository: Repository): boolean {
  return repository.url.startsWith('oci://');
}
