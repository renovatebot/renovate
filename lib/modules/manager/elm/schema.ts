import { z } from 'zod';

/**
 * Elm application dependencies structure
 * Applications have nested direct/indirect dependencies
 */
const ElmApplicationDependencies = z.object({
  direct: z.record(z.string(), z.string()).optional().default({}),
  indirect: z.record(z.string(), z.string()).optional().default({}),
});

/**
 * Elm application elm.json schema
 */
export const ElmApplicationJson = z.object({
  type: z.literal('application'),
  'elm-version': z.string(),
  'source-directories': z.array(z.string()).optional(),
  dependencies: ElmApplicationDependencies.optional().default({
    direct: {},
    indirect: {},
  }),
  'test-dependencies': ElmApplicationDependencies.optional().default({
    direct: {},
    indirect: {},
  }),
});

/**
 * Elm package elm.json schema
 * Packages have flat dependencies (just name -> constraint mapping)
 */
export const ElmPackageJson = z.object({
  type: z.literal('package'),
  name: z.string().optional(),
  version: z.string().optional(),
  'elm-version': z.string(),
  dependencies: z.record(z.string(), z.string()).optional().default({}),
  'test-dependencies': z.record(z.string(), z.string()).optional().default({}),
});

/**
 * Union type for any valid elm.json
 */
export const ElmJson = z.discriminatedUnion('type', [
  ElmApplicationJson,
  ElmPackageJson,
]);

export type ElmApplicationJsonType = z.infer<typeof ElmApplicationJson>;
export type ElmPackageJsonType = z.infer<typeof ElmPackageJson>;
export type ElmJsonType = z.infer<typeof ElmJson>;
