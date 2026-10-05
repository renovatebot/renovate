import { isNonEmptyStringAndNotWhitespace } from '@sindresorhus/is';
import { regEx } from '../../../util/regex.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';

export function extractPackageFile(content: string): PackageFileContent {
  const dep: PackageDependency = {
    depName: 'node',
    currentValue: content
      .split('\n')
      // Remove code comments
      .map((line) => line.replace(regEx(/#.*$/), '').trim())
      .filter(isNonEmptyStringAndNotWhitespace)
      .join('\n')
      .trim(),
    datasource: NodeVersionDatasource.id,
  };
  return { deps: [dep] };
}
