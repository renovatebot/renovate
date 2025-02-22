import { z } from 'zod';
import { Toml, Yaml } from '../../../util/schema-utils';

/**
 * config of `pixi.toml` of `tool.pixi` of `pyproject.toml`
 */
export const PixiConfigSchema = z.union([z.object({}), z.undefined()]);

export const PyprojectSchema = z
  .object({
    tool: z.object({ pixi: PixiConfigSchema }),
  })
  .transform(({ tool: { pixi } }) => {
    return pixi ?? null;
  });

export const PyprojectToml = Toml.pipe(PyprojectSchema);
export const PixiToml = Toml.pipe(PixiConfigSchema);

export const LockfileYaml = Yaml.pipe(
  z.object({
    version: z.number(),
  }),
);
