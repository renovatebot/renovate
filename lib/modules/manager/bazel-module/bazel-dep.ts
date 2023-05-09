import is from '@sindresorhus/is';
import { BazelDatasource } from '../../datasource/bazel';
import type { PackageDependency } from '../types';
import { RecordFragment, StringFragment, ValueFragment } from './fragments';

export function toPackageDependency(
  value: ValueFragment
): PackageDependency | null {
  const record = RecordFragment.safeAs(value);
  if (!record) {
    return null;
  }
  const { rule, name, version } = record.children;
  if (is.falsy(rule) || is.falsy(name) || is.falsy(version)) {
    return null;
  }
  return {
    datasource: BazelDatasource.id,
    depType: StringFragment.as(rule).value,
    depName: StringFragment.as(name).value,
    currentValue: StringFragment.as(version).value,
  };
}
