import { isNonEmptyString } from '@sindresorhus/is';
import { z } from 'zod/v4';
import { coerceArray } from '../../../util/array.ts';
import { Toml } from '../../../util/schema-utils/index.ts';
import { PythonVersionDatasource } from '../../datasource/python-version/index.ts';
import * as pep440 from '../../versioning/pep440/index.ts';
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
      const res: PackageFileContent = { deps: [] };

      if (isNonEmptyString(requiresPython)) {
        res.extractedConstraints = { python: requiresPython };
        res.deps.push({
          packageName: 'python',
          depType: 'requires-python',
          currentValue: requiresPython,
          commitMessageTopic: 'Python',
          datasource: PythonVersionDatasource.id,
          versioning: pep440.id,
        });
      }

      res.deps.push(...coerceArray(dependencies));

      return res;
    }),
);
