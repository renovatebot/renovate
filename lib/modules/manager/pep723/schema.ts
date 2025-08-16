import is from '@sindresorhus/is';
import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';
import { depTypes, pep508ToPackageDependency } from '../pep621/utils';
import type { PackageFileContent } from '../types';

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

      if (is.nonEmptyString(requiresPython)) {
        res.extractedConstraints = { python: requiresPython };
      }

      return res;
    }),
);
