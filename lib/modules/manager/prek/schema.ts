import { z } from 'zod/v4';
import { LooseArray, Toml } from '../../../util/schema-utils/index.ts';

export const PrekHook = z.object({
  id: z.string().optional(),
  language: z.string().optional(),
  additional_dependencies: LooseArray(z.string()).catch([]).optional(),
});

export const PrekRepo = z.object({
  repo: z.string().optional(),
  rev: z.string().optional(),
  hooks: LooseArray(PrekHook).catch([]).optional(),
});

export const PrekConfig = z.object({
  repos: LooseArray(PrekRepo).catch([]).optional(),
});

export const PrekToml = Toml.pipe(PrekConfig);

export type PrekHook = z.infer<typeof PrekHook>;
export type PrekRepo = z.infer<typeof PrekRepo>;
export type PrekConfig = z.infer<typeof PrekConfig>;
