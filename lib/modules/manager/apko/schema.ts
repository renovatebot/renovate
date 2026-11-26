import { z } from 'zod/v4';
import { Json, Yaml } from '../../../util/schema-utils/index.ts';

function unspecifiedIfNull(value: unknown): unknown {
  return value === null ? undefined : value;
}

function numericArchToString(value: unknown): unknown {
  return typeof value === 'number' ? String(value) : value;
}

const optionalStrings = z.preprocess(
  unspecifiedIfNull,
  z.array(z.string()).optional(),
);

const optionalArchs = z.preprocess(
  unspecifiedIfNull,
  z.array(z.preprocess(numericArchToString, z.string())).optional(),
);

export const ApkoConfig = Yaml.pipe(
  z.object({
    contents: z.object({
      repositories: optionalStrings,
      build_repositories: optionalStrings,
      packages: z.array(z.string()),
    }),
    archs: optionalArchs,
  }),
);

export type ApkoConfig = z.infer<typeof ApkoConfig>;

const ApkoLockPackage = z.object({
  name: z.string(),
  version: z.string(),
});

export type ApkoLockPackage = z.infer<typeof ApkoLockPackage>;

export const ApkoLock = Json.pipe(
  z.object({
    contents: z.object({
      packages: z.array(ApkoLockPackage),
    }),
  }),
);

export type ApkoLock = z.infer<typeof ApkoLock>;
