import { z } from 'zod';

const FlakeLockGitHubNodeSchema = z.object({
  locked: z.object({
    lastModified: z.number(),
    narHash: z.string(),
    owner: z.string(),
    repo: z.string(),
    rev: z.string(),
    type: z.literal('github'),
  }),
  original: z.object({
    owner: z.string(),
    repo: z.string(),
    ref: z.ostring(),
    type: z.literal('github'),
  }),
});
const FlakeLockGitLabNode = z.object({
  locked: z.object({
    lastModified: z.number(),
    narHash: z.string(),
    owner: z.string(),
    repo: z.string(),
    rev: z.string(),
    type: z.literal('gitlab'),
  }),
  original: z.object({
    owner: z.string(),
    repo: z.string(),
    ref: z.ostring(),
    type: z.literal('gitlab'),
  }),
});
const FlakeLockGitNode = z.object({
  locked: z.object({
    lastModified: z.number(),
    narHash: z.string(),
    url: z.string(),
    ref: z.string(),
    rev: z.string(),
    refCount: z.number(),
    type: z.literal('git'),
  }),
  original: z.object({
    url: z.string(),
    type: z.literal('git'),
  }),
});
const FlakeLockTarballNode = z.object({
  locked: z.object({
    narHash: z.string(),
    url: z.string(),
    type: z.literal('tarball'),
  }),
  original: z.object({
    url: z.string(),
    type: z.literal('tarball'),
  }),
});
const FlakeLockRootNodeSchema = z.object({
  inputs: z.record(z.union([z.string(), z.array(z.string())])),
});
const FlakeLockNodeSchema = z.intersection(
  z.object({
    flake: z.oboolean(),
    inputs: z.optional(z.record(z.union([z.string(), z.array(z.string())]))),
  }),
  z.union([
    FlakeLockGitHubNodeSchema,
    FlakeLockGitLabNode,
    FlakeLockGitNode,
    FlakeLockTarballNode,
  ])
);
const FlakeLockNode = z.union([FlakeLockRootNodeSchema, FlakeLockNodeSchema]);

const FlakeLockNodes = z.record(
  z.union([FlakeLockRootNodeSchema, FlakeLockNode])
);
export const FlakeLockRootSchema = z.object({
  root: z.string(),
  version: z.number(),
  nodes: FlakeLockNodes,
});

export type FlakeLockRoot = z.infer<typeof FlakeLockRootSchema>;
export type FlakeLockNode = z.infer<typeof FlakeLockNode>;
export type FlakeLockGitHubNode = z.infer<typeof FlakeLockGitHubNodeSchema>;
