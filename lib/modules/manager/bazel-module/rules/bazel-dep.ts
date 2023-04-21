import { z } from 'zod';
import { BazelRegistryDatasource } from '../../../datasource/bazel-registry';
import type { PackageDependency } from '../../types';

export const BazelDepTarget = z
  .object({
    rule: z.enum(['bazel_dep']),
    name: z.string(),
    version: z.string(),
    dev_dependency: z.boolean().optional(),
  })
  .transform(({ rule, name, version, dev_dependency }): PackageDependency[] => {
    const dep: PackageDependency = {
      datasource: BazelRegistryDatasource.id,
      depType: rule,
      depName: name,
      currentValue: version,
    };
    return [dep];
  });
