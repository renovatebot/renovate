import { z } from 'zod/v3';
import { LooseRecord, Yaml } from '../../../util/schema-utils/index.ts';

const VersionField = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val) => val?.toString());

const XcodeGenSwiftPackage = z.object({
  url: z.string().optional(),
  github: z.string().optional(),
  path: z.string().optional(),
  from: VersionField,
  majorVersion: VersionField,
  minorVersion: VersionField,
  exactVersion: VersionField,
  version: VersionField,
  minVersion: VersionField,
  maxVersion: VersionField,
  branch: z.string().optional(),
  revision: z.string().optional(),
  group: z.string().optional(),
  excludeFromProject: z.boolean().optional(),
});

export type XcodeGenSwiftPackage = z.infer<typeof XcodeGenSwiftPackage>;

export const XcodeGenProjectFile = Yaml.pipe(
  z.object({
    packages: LooseRecord(XcodeGenSwiftPackage).optional(),
  }),
);

export type XcodeGenProjectFile = z.infer<typeof XcodeGenProjectFile>;
