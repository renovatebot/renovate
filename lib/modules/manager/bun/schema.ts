import { z } from 'zod';

const BunfigRegistryConfigSchema = z.union([
  z.string(),
  z.object({ url: z.string() }),
]);

const BunfigInstallSchema = z.object({
  registry: BunfigRegistryConfigSchema.optional(),
  scopes: z.record(z.string(), BunfigRegistryConfigSchema).optional(),
});

export const BunfigSchema = z.object({
  install: BunfigInstallSchema.optional(),
});

const ResolvedBunfigInstallSchema = z.object({
  registry: z.string().optional(),
  scopes: z.record(z.string(), z.string()).optional(),
});

export const ResolvedBunfigSchema = z.object({
  install: ResolvedBunfigInstallSchema.optional(),
});

export type BunfigConfig = z.infer<typeof ResolvedBunfigSchema>;
export type BunfigRegistryConfig = z.infer<typeof BunfigRegistryConfigSchema>;
export type RawBunfigConfig = z.infer<typeof BunfigSchema>;
