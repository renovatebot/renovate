import { z } from 'zod/v4';
import { coerceObject } from '../../../util/object.ts';
import {
  LooseArray,
  LooseRecord,
  Toml,
} from '../../../util/schema-utils/index.ts';

export const JuliaProject = Toml.pipe(
  z.object({
    version: z.string().optional().catch(undefined),
    manifest: z.string().optional().catch(undefined),
    deps: LooseRecord(z.string()).optional().catch(undefined),
    weakdeps: LooseRecord(z.string()).optional().catch(undefined),
    extras: LooseRecord(z.string()).optional().catch(undefined),
    compat: LooseRecord(z.string()).optional().catch(undefined),
    targets: LooseRecord(LooseArray(z.string())).optional().catch(undefined),
    sources: LooseRecord(
      z.object({ url: z.string().optional(), path: z.string().optional() }),
    )
      .optional()
      .catch(undefined),
  }),
);

const ManifestPackages = LooseRecord(
  LooseArray(z.object({ uuid: z.string(), version: z.string().optional() })),
);

export const JuliaManifest = Toml.pipe(
  z.looseObject({
    manifest_format: z.string().optional().catch(undefined),
    deps: ManifestPackages.optional().catch(undefined),
  }),
).transform(({ manifest_format, deps, ...packages }) =>
  // Julia 1.7 and later write format 2.0, which puts the packages under
  // `[deps]`; earlier versions put them at the top level.
  manifest_format === undefined
    ? ManifestPackages.parse(packages)
    : coerceObject(deps),
);
