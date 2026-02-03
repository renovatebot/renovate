import { z } from 'zod';
import { Json } from '../../../util/schema-utils/index.ts';

const InputType = z.enum([
  'file',
  'git',
  'github',
  'gitlab',
  'indirect',
  'path',
  'sourcehut',
  'tarball',
]);

const LockedInput = z.object({
  ref: z.string().optional(),
  rev: z.string().optional(),
  type: InputType,
  url: z.string().optional(),
});

const OriginalInput = z.object({
  host: z.string().optional(),
  owner: z.string().optional(),
  repo: z.string().optional(),
  ref: z.string().optional(),
  rev: z.string().optional(),
  type: InputType,
  url: z.string().optional(),
});

export const NixInput = z.object({
  inputs: z.record(z.string(), z.string().or(z.array(z.string()))).optional(),
  locked: LockedInput.optional(),
  original: OriginalInput.optional(),
});

export type NixInput = z.infer<typeof NixInput>;

// https://github.com/NixOS/nix/blob/f7fc24c/src/libflake/include/nix/flake/lockfile.hh
export const NixFlakeLock = Json.pipe(
  z.object({
    nodes: z.union([
      z.record(
        z.literal('root'),
        z.object({
          inputs: z.record(z.string(), z.string()),
        }),
      ),
      z.record(z.string(), NixInput),
    ]),
    version: z.literal(7),
  }),
);

export type NixFlakeLock = z.infer<typeof NixFlakeLock>;
