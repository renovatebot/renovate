import { z } from 'zod';
import { BazelDatasource } from '../../datasource/bazel';
import type { PackageDependency } from '../types';
import {
  BooleanFragmentSchema,
  RecordFragment,
  StringFragmentSchema,
} from './fragments';

const BazelDepChildrenSchema = z.object({
  rule: StringFragmentSchema.extend({
    value: z.literal('bazel_dep'),
  }),
  name: StringFragmentSchema,
  version: StringFragmentSchema,
  dev_dependency: BooleanFragmentSchema.optional(),
});

const ToBazelDep = BazelDepChildrenSchema.transform(
  ({ rule, name, version }): PackageDependency => ({
    datasource: BazelDatasource.id,
    depType: rule.value,
    depName: name.value,
    currentValue: version.value,
  })
);

export function toPackageDependency(
  record: RecordFragment
): PackageDependency | null {
  const parseResult = ToBazelDep.safeParse(record.children);
  return parseResult.success ? parseResult.data : null;
}
