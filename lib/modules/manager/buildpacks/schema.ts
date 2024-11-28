import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';

const BuildpackByName = z.object({
  id: z.string(),
  version: z.string().optional(),
});

const BuildpackByURI = z.object({
  uri: z.string(),
});

const BuildpackGroup = BuildpackByName.or(BuildpackByURI);

type BuildpackByNameType = z.infer<typeof BuildpackByName>;
type BuildpackByURIType = z.infer<typeof BuildpackByURI>;
type BuildpackGroupType = z.infer<typeof BuildpackGroup>;

export function isBuildpackByName(
  group: BuildpackGroupType,
): group is BuildpackByNameType {
  return 'id' in group;
}

export function isBuildpackByURI(
  group: BuildpackGroupType,
): group is BuildpackByURIType {
  return 'uri' in group;
}

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
