import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

/**
 * APM dependencies are declared under `dependencies.apm` / `devDependencies.apm`
 * as an array of `[host/]owner/repo[/subpath]#<ref>` strings.
 *
 * MCP server entries under the sibling `mcp` key are objects without a pinnable
 * version, so `LooseArray(z.string())` keeps only the string entries and drops
 * everything else (MCP objects, malformed entries). A non-array `apm` value is
 * caught and treated as absent.
 */
const ApmDependencySection = z.object({
  apm: LooseArray(z.string()).optional().catch(undefined),
});

export const ApmManifest = z.object({
  dependencies: ApmDependencySection.optional(),
  devDependencies: ApmDependencySection.optional(),
});

export type ApmManifest = z.infer<typeof ApmManifest>;
