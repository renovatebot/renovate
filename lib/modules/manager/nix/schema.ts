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
  shallow: z.boolean().optional(),
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
  inputs: z.record(z.string(), z.string().or(z.array(z.string()))).optional(),
  locked: LockedInput.optional(),
  original: OriginalInput.optional(),
});

export const NixFlakeLock = Json.pipe(
  z.object({
    nodes: z.record(z.string(), NixInput),
    root: z.literal('root').optional(),
    version: z.literal(7),
  }),
);

export type NixFlakeLock = z.infer<typeof NixFlakeLock>;
