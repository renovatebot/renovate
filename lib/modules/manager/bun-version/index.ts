import type { Category } from '../../../constants/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { id, isValid } from '../../versioning/npm/index.ts';

import type { PackageDependency, PackageFileContent } from '../types.ts';

export const categories: Category[] = ['js'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.bun-version$/'],
  versioning: id,
};

export const supportedDatasources = [NpmDatasource.id];

export function extractPackageFile(content: string): PackageFileContent | null {
  if (!content) {
    return null;
  }

  if (content.split('\n').length > 2) {
    return null;
  }

  const dep: PackageDependency = {
    depName: 'Bun',
    packageName: 'bun',
    currentValue: content.trim(),
    datasource: NpmDatasource.id,
  };

  if (!isValid(content.trim())) {
    dep.skipReason = 'invalid-version';
  }
  return { deps: [dep] };
}
