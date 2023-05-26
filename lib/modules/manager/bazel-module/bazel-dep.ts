import { z } from 'zod';
import { BazelDatasource } from '../../datasource/bazel';
import type { PackageDependency } from '../types';
import {
  BooleanFragmentSchema,
  RecordFragmentSchema,
  StringFragmentSchema,
} from './fragments';

const BazelDepSchema = RecordFragmentSchema.extend({
  children: z.object({
    rule: StringFragmentSchema.extend({
      value: z.literal('bazel_dep'),
    }),
    name: StringFragmentSchema,
    version: StringFragmentSchema,
    dev_dependency: BooleanFragmentSchema.optional(),
  }),
});

export const ToBazelDep = BazelDepSchema.transform(
  ({ children: { rule, name, version } }): PackageDependency => ({
    datasource: BazelDatasource.id,
    depType: rule.value,
    depName: name.value,
    currentValue: version.value,
  })
);
