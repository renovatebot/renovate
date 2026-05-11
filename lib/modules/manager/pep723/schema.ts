import { isNonEmptyString } from '@sindresorhus/is';
import { z } from 'zod/v3';
import { Toml } from '../../../util/schema-utils/index.ts';
import { depTypes, pep508ToPackageDependency } from '../pep621/utils.ts';
import type { PackageFileContent } from '../types.ts';

const Pep723Dep = z
  .string()
  .transform((dep) => pep508ToPackageDependency(depTypes.dependencies, dep));

export const Pep723 = Toml.pipe(
  z
    .object({
      'requires-python': z.string().optional(),
      dependencies: z
        .array(Pep723Dep)
        .transform((deps) => deps.filter((dep) => !!dep))
        .optional(),
    })
    .transform(({ 'requires-python': requiresPython, dependencies }) => {
      const res: PackageFileContent = { deps: dependencies ?? [] };

      if (isNonEmptyString(requiresPython)) {
        res.extractedConstraints = { python: requiresPython };
      }

      return res;
    }),
);
