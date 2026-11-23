import { z } from 'zod/v4';
import { Json, Yaml } from '../../../util/schema-utils/index.ts';

export const ApkoConfig = Yaml.pipe(
  z.object({
    contents: z.object({
      repositories: z.array(z.string()).optional(),
      build_repositories: z.array(z.string()).optional(),
      packages: z.array(z.string()),
    }),
    archs: z.array(z.string()).optional(),
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
