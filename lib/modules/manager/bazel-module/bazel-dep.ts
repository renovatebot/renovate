import { z } from 'zod';
import { BazelDatasource } from '../../datasource/bazel';
import type { PackageDependency } from '../types';
import {
  BooleanFragment,
  Fragments,
  RecordFragment,
  StringFragment,
} from './fragments';

const BazelDepRecord = RecordFragment.schema
  .extend({
    children: z.object({
      rule: StringFragment.schema.extend({
        value: z.enum(['bazel_dep']),
      }),
      name: StringFragment.schema,
      version: StringFragment.schema,
      dev_dependency: BooleanFragment.schema.optional(),
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
