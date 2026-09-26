import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

/**
 * APM dependencies are declared under `dependencies.apm` / `devDependencies.apm`
 * as an array of `[host/]owner/repo[/subpath]#<ref>` strings.
 */
const ApmDependencySection = z.object({
  apm: LooseArray(z.string()).catch([]),
});

export const ApmManifest = z.object({
  dependencies: ApmDependencySection.optional(),
  devDependencies: ApmDependencySection.optional(),
});

export type ApmManifest = z.infer<typeof ApmManifest>;
