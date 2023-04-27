import { z } from 'zod';
import { BazelDatasource } from '../../../datasource/bazel';
import type { PackageDependency } from '../../types';

const StringFragmentSchema = z.object({
  type: z.enum(['string']),
  isComplete: z.boolean(),
  value: z.string(),
});

const BooleanFragmentSchema = z.object({
  type: z.enum(['boolean']),
  isComplete: z.boolean(),
  value: z.boolean(),
});

export const BazelDepRecord = z.object({
  type: z.enum(['record']),
  isComplete: z.boolean(),
  children: z.object({
    rule: z.object({
      type: z.enum(['string']),
      isComplete: z.boolean(),
      value: z.enum(['bazel_dep']),
    }),
    name: StringFragmentSchema,
    version: StringFragmentSchema,
    dev_dependency: BooleanFragmentSchema.optional(),
  }),
});

export const BazelDepRecordToPackageDependency = BazelDepRecord.transform(
  ({ children: { rule, name, version } }): PackageDependency => {
    const dep: PackageDependency = {
      datasource: BazelDatasource.id,
      depType: rule.value,
      depName: name.value,
      currentValue: version.value,
    };
    return dep;
  }
);
