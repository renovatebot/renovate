import { z } from 'zod';
import { BazelDatasource } from '../../datasource/bazel';
import type { PackageDependency } from '../types';
import { Fragments, RecordFragment } from './fragments';

// TODO: Move schema to static properties on the XXXFragment classes.

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

export const BazelDepRecord = z
  .object({
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
  })
  .transform((frag): RecordFragment => {
    return Fragments.asRecord(frag);
  });

export const BazelDepRecordToPackageDependency = BazelDepRecord.transform(
  ({ children: { rule, name, version } }): PackageDependency => ({
    datasource: BazelDatasource.id,
    depType: Fragments.asString(rule).value,
    depName: Fragments.asString(name).value,
    currentValue: Fragments.asString(version).value,
  })
);
