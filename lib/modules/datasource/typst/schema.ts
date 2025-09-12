import { z } from 'zod';
import { LooseArray, Toml } from '../../../util/schema-utils';
import { fromBase64 } from '../../../util/string';
import { api as semver } from '../../versioning/semver-coerced';

export const Versions = LooseArray(
  z
    .object({
      type: z.literal('dir'),
      name: z.string(),
    })
    .transform(({ name }) => name)
    .refine((version) => semver.isValid(version)),
);

export const SourceUrl = z
  .object({ content: z.string() })
  .transform(({ content }) => fromBase64(content))
  .pipe(Toml)
  .pipe(
    z
      .object({
        package: z.object({
          repository: z.string(),
        }),
      })
      .transform((data) => data.package.repository),
  )
  .optional()
  .catch(undefined);
