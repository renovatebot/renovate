import { z } from 'zod/v3';
import { LooseArray, Toml } from '../../../util/schema-utils/index.ts';

export const PrekHookSchema = z.object({
  id: z.string().optional(),
  language: z.string().optional(),
  additional_dependencies: LooseArray(z.string()).catch([]).optional(),
});

export const PrekRepoSchema = z.object({
  repo: z.string().optional(),
  rev: z.string().optional(),
  hooks: LooseArray(PrekHookSchema).catch([]).optional(),
});

export const PrekConfigSchema = z.object({
  repos: LooseArray(PrekRepoSchema).catch([]).optional(),
});

export const PrekTomlSchema = Toml.pipe(PrekConfigSchema);

export type PrekHook = z.infer<typeof PrekHookSchema>;
export type PrekRepo = z.infer<typeof PrekRepoSchema>;
export type PrekConfig = z.infer<typeof PrekConfigSchema>;
