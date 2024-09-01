import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';
import { depTypes, pep508ToPackageDependency } from '../pep621/utils';

const Pep723Dep = z
  .string()
  .transform((dep) => pep508ToPackageDependency(depTypes.dependencies, dep));

export const Pep723Schema = Toml.pipe(
  z
    .object({
      dependencies: z
        .array(Pep723Dep)
        .transform((deps) => deps.filter((dep) => !!dep))
        .optional(),
    })
    .transform(({ dependencies }) => dependencies ?? []),
);
