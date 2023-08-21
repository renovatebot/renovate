import { z } from 'zod';
import { Result } from '../../../util/result';
import { LooseArray, Toml } from '../../../util/schema-utils';

const Lockfile = Toml.pipe(
  z.object({
    package: LooseArray(
      z
        .object({
          name: z.string(),
          version: z.string(),
        })
        .transform(({ name, version }): [string, string] => [name, version])
    ).transform((entries) => Object.fromEntries(entries)),
  })
).transform(({ package: mapping }) => mapping);

export function extractLockFileEntries(input: unknown): Record<string, string> {
  return Result.wrap(Lockfile.safeParse(input)).unwrap({});
}
