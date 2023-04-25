import { z } from 'zod';
import { BazelDatasource } from '../../../datasource/bazel';
import type { PackageDependency } from '../../types';

export const BazelDepTarget = z.object({
  rule: z.enum(['bazel_dep']),
  name: z.string(),
  version: z.string(),
  dev_dependency: z.boolean().optional(),
});

export const BazelDepToPackageDependency = BazelDepTarget.transform(
  ({ rule, name, version, dev_dependency }): PackageDependency[] => {
    const dep: PackageDependency = {
      datasource: BazelDatasource.id,
      depType: rule,
      depName: name,
      currentValue: version,
    };
    return [dep];
  }
);
