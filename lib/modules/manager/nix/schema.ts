import { z } from 'zod';
import { Json } from '../../../util/schema-utils';

export const InputType = z.enum([
  'git',
  'github',
  'gitlab',
  'indirect',
  'sourcehut',
  'tarball',
]);

export const LockedInput = z.object({
  ref: z.string().optional(),
  rev: z.string(),
  type: InputType,
});

export const OriginalInput = z.object({
  host: z.string().optional(),
  owner: z.string().optional(),
  repo: z.string().optional(),
  ref: z.string().optional(),
  type: InputType,
  url: z.string().optional(),
});

export const NixInput = z.object({
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
