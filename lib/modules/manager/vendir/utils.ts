import upath from 'upath';
import type { Contents, HelmChartContent } from './types';

export function isFileInDir(dir: string, file: string): boolean {
  return upath.relative(dir, file).startsWith('./');
}

export function isHelmChart(item: Contents): item is HelmChartContent {
  return 'helmChart' in item;
}

// TODO: Add Support for Registry Aliases (See Helmv3 for possible implementation)
