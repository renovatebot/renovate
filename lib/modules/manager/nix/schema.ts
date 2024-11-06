import { z } from 'zod';
import { Json } from '../../../util/schema-utils';

const InputType = z.enum([
  'git',
  'github',
  'gitlab',
  'indirect',
  'sourcehut',
  'tarball',
]);

const LockedInput = z.object({
  ref: z.string().optional(),
  rev: z.string(),
  type: InputType,
});

const OriginalInput = z.object({
  host: z.string().optional(),
  owner: z.string().optional(),
  repo: z.string().optional(),
  ref: z.string().optional(),
  type: InputType,
  url: z.string().optional(),
});

const NixInput = z.object({
  inputs: z.record(z.string(), z.string().or(z.array(z.string()))).optional(),
  locked: LockedInput.optional(),
  original: OriginalInput.optional(),
});

export const NixFlakeLock = Json.pipe(
  z.object({
    nodes: z.record(z.string(), NixInput),
    version: z.literal(7),
  }),
);

export type NixFlakeLock = z.infer<typeof NixFlakeLock>;
