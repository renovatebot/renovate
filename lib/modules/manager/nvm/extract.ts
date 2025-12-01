import { isNonEmptyStringAndNotWhitespace } from '@sindresorhus/is';
import { NodeVersionDatasource } from '../../datasource/node-version';
import type { PackageDependency, PackageFileContent } from '../types';

export function extractPackageFile(content: string): PackageFileContent {
  const dep: PackageDependency = {
    depName: 'node',
    currentValue: content
      .split('\n')
      // Remove code comments
      .map((line) => line.replace(/#.*$/, '').trim())
      .filter(isNonEmptyStringAndNotWhitespace)
      .join('\n')
      .trim(),
    datasource: NodeVersionDatasource.id,
  };
  return { deps: [dep] };
}
