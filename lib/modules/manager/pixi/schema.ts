import { z } from 'zod';
import { Toml, Yaml } from '../../../util/schema-utils';

/**
 * config of `pixi.toml` of `tool.pixi` of `pyproject.toml`
 */
export const PixiConfigSchema = z.object({}).nullish();

export type PixiConfig = z.infer<typeof PixiConfigSchema>;

export const PyprojectSchema = z.object({
  tool: z.object({ pixi: PixiConfigSchema.nullish() }).optional(),
});

export const PyprojectToml = Toml.pipe(PyprojectSchema);
export const PixiToml = Toml.pipe(PixiConfigSchema);

export const LockfileYaml = Yaml.pipe(
  z.object({
    version: z.number(),
  }),
);
