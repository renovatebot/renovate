import is from '@sindresorhus/is';
import { BitriseDatasource } from '../../datasource/bitrise';
import type { PackageDependency } from '../types';

export function parseStep(stepRef: string): PackageDependency | null {
  if (is.emptyString(stepRef)) {
    return null;
  }

  const dep: PackageDependency = {
    datasource: BitriseDatasource.id,
    replaceString: stepRef,
  };

  const splitted = stepRef.split('@', 2);

  // no version
  if (splitted.length === 1) {
    return {
      ...dep,
      packageName: stepRef,
      skipReason: 'unspecified-version',
    };
  }

  const [packageName, currentValue] = splitted;
  return {
    ...dep,
    packageName,
    currentValue,
  };
}
