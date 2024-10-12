import { z } from 'zod';
import { Json } from '../../../util/schema-utils';

export const InputType = z.enum([
  'git',
  'github',
  'gitlab',
  'indirect',
  'sourcehut',
]);

export const LockedInput = z.object({
  host: z.string().optional(),
  lastModified: z.number(),
  narHash: z.string(),
  owner: z.string().optional(),
  repo: z.string().optional(),
  ref: z.string().optional(),
  rev: z.string(),
  revCount: z.number().optional(),
  type: InputType,
  url: z.string().optional(),
});

export const OriginalInput = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  ref: z.string().optional(),
  type: InputType,
  url: z.string().optional(),
});

export const NixInput = z.object({
  inputs: z.record(z.string(), z.string()).optional(),
  locked: LockedInput.optional(),
  original: OriginalInput.optional(),
});

export const NixFlakeLock = Json.pipe(
  z.object({
    nodes: z.record(z.string(), NixInput).optional(),
    root: z.string(),
    version: z.number(),
  }),
);

export type NixFlakeLock = z.infer<typeof NixFlakeLock>;
