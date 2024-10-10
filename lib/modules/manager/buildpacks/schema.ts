import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';

const BuildpackGroup = z.object({
  uri: z.string().optional(),
});

const IoBuildpacks = z.object({
  builder: z.string().optional(),
  group: z.array(BuildpackGroup).optional(),
});

export const ProjectDescriptor = z.object({
  _: z.object({
    'schema-version': z.string(),
  }),
  io: z
    .object({
      buildpacks: IoBuildpacks.optional(),
    })
    .optional(),
});

export type ProjectDescriptor = z.infer<typeof ProjectDescriptor>;
export const ProjectDescriptorToml = Toml.pipe(ProjectDescriptor);
