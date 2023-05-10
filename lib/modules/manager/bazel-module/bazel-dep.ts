import { z } from 'zod';
import { BazelDatasource } from '../../datasource/bazel';
import type { PackageDependency } from '../types';
import {
  BooleanFragment,
  RecordFragment,
  StringFragment,
  ValueFragment,
} from './fragments';

const BazelDepChildrenSchema = z.object({
  rule: StringFragment.schema.extend({
    value: z.literal('bazel_dep'),
  }),
  name: StringFragment.schema,
  version: StringFragment.schema,
  dev_dependency: BooleanFragment.schema.optional(),
});

export function toPackageDependency(
  value: ValueFragment
): PackageDependency | null {
  const record = RecordFragment.safeAs(value);
  if (!record) {
    return null;
  }
  const parseResult = BazelDepChildrenSchema.safeParse(record.children);
  if (!parseResult.success) {
    return null;
  }
  const { rule, name, version } = parseResult.data;
  return {
    datasource: BazelDatasource.id,
    depType: rule.value,
    depName: name.value,
    currentValue: version.value,
  };
}
