import { isPlainObject, isString } from '@sindresorhus/is';
import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

/**
 * Object-form entry which installs a package from a registry:
 * `- id: owner/repo`, with `version:` and an optional `registry:` name.
 * Other object forms (`- git:`, `- path:`) and MCP entries are dropped.
 */
export const ApmRegistryEntry = z.object({
  id: z.string(),
  version: z.string().optional(),
  registry: z.string().optional(),
});

export type ApmRegistryEntry = z.infer<typeof ApmRegistryEntry>;

/**
 * APM dependencies are declared under `dependencies.apm` / `devDependencies.apm`
 * as `[host/]owner/repo[/subpath]#<ref>` strings or registry entry objects.
 */
const ApmDependencySection = z.object({
  apm: LooseArray(z.union([z.string(), ApmRegistryEntry])).catch([]),
});

export interface ApmRegistries {
  /** registry name -> base URL */
  urls: Map<string, string>;
  /** `registries.default`: the registry that plain `owner/repo#<ref>` entries route to */
  defaultName?: string;
}

/**
 * The top-level `registries:` block: a map of registry name to `{ url }`, plus
 * the reserved `default:` key naming one of them.
 */
const ApmRegistriesBlock = z
  .record(z.string(), z.unknown())
  .transform((block): ApmRegistries => {
    const urls = new Map<string, string>();
    let defaultName: string | undefined;
    for (const [name, body] of Object.entries(block)) {
      if (name === 'default') {
        if (isString(body) && body.trim()) {
          defaultName = body.trim();
        }
        continue;
      }
      const url = isPlainObject(body) ? body.url : undefined;
      if (isString(url) && url.trim()) {
        urls.set(name, url.trim());
      }
    }
    return { urls, defaultName };
  });

export const ApmManifest = z.object({
  registries: ApmRegistriesBlock.optional().catch(undefined),
  dependencies: ApmDependencySection.optional(),
  devDependencies: ApmDependencySection.optional(),
});

export type ApmManifest = z.infer<typeof ApmManifest>;
