import is from '@sindresorhus/is';
import upath from 'upath';
import type { Contents, HelmChartContent, Repository } from './types';

export function isFileInDir(dir: string, file: string): boolean {
  return upath.relative(dir, file).startsWith('./');
}

export function isHelmChart(item: Contents): item is HelmChartContent {
  return 'helmChart' in item;
}

export function isOCIRegistry(repository: Repository): boolean {
  if (is.nullOrUndefined(repository)) {
    return false;
  }
  return repository.url.startsWith('oci://');
}

// TODO: Add Support for Registry Aliases (See Helmv3 for possible implementation)
