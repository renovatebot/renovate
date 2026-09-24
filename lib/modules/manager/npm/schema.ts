import { z } from 'zod/v4';
import { coerceArray } from '../../../util/array.ts';
import { regEx } from '../../../util/regex.ts';
import {
  Json,
  LooseRecord,
  Nullish,
  Yaml,
} from '../../../util/schema-utils/index.ts';
import { parseUrl } from '../../../util/url.ts';

// pnpm ignores registry URLs containing `${...}` env-var interpolation since v11.5.3
function hasEnvVar(value: string): boolean {
  return value.includes('${');
}

function withoutEnvVarRegistries(
  registries: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(registries).filter(([, url]) => !hasEnvVar(url)),
  );
}

/**
 * pnpm ignores a registry URL which interpolates an env var, and refuses one
 * which embeds credentials, because `pnpm-workspace.yaml` is committed to the
 * repository.
 */
function isUsableRegistryUrl(url: string): boolean {
  if (hasEnvVar(url)) {
    return false;
  }

  const parsed = parseUrl(url);
  return !!parsed && !parsed.username && !parsed.password;
}

/**
 * A registry of the URL-keyed `registries` shape, added in pnpm v11.23.
 *
 * Only `scopes` routes packages to the registry: `prefix` names a
 * bare-specifier alias which we do not support yet, while `serverType` and
 * `supportsTimeField` merely describe the server.
 *
 * https://pnpm.io/registries
 */
const PnpmRegistry = Nullish(
  z.object({
    scopes: z.array(z.string()).optional(),
  }),
);
type PnpmRegistry = z.infer<typeof PnpmRegistry>;

/**
 * Flatten the URL-keyed shape into the older `<scope>: <url>` one, so that both
 * shapes resolve the same way.
 */
function scopeRoutesFromRegistries(
  registries: Record<string, PnpmRegistry>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [url, registry] of Object.entries(registries)) {
    if (!isUsableRegistryUrl(url)) {
      continue;
    }

    for (const scope of coerceArray(registry?.scopes)) {
      // the bare `@` scope routes the scope-less default registry
      result[scope === '@' ? 'default' : scope] = url;
    }
  }

  return result;
}

export const PnpmCatalogs = z.object({
  catalog: z.optional(z.record(z.string(), z.string())),
  catalogs: z.optional(z.record(z.string(), z.record(z.string(), z.string()))),
});
export type PnpmCatalogs = z.infer<typeof PnpmCatalogs>;

export const YarnCatalogs = z.object({
  catalog: z.optional(z.record(z.string(), z.string())),
  catalogs: z
    .optional(z.record(z.string(), z.record(z.string(), z.string())))
    .catch(undefined),
});
export type YarnCatalogs = z.infer<typeof YarnCatalogs>;

export const YarnConfig = Yaml.pipe(
  z
    .object({
      npmRegistryServer: z.string().optional(),
      npmScopes: z
        .record(
          z.string(),
          z.object({
            npmRegistryServer: z.string().optional(),
          }),
        )
        .optional(),
    })
    .and(YarnCatalogs),
);
export type YarnConfig = z.infer<typeof YarnConfig>;

export const PnpmWorkspaceFile = Yaml.pipe(
  z
    .object({
      packages: z.array(z.string()).optional(),
      minimumReleaseAge: Nullish(z.number()),
      minimumReleaseAgeExclude: z.array(z.string()).optional(),
      overrides: z.record(z.string(), z.string()).optional(),
      registry: Nullish(z.string()),
      // pnpm accepts `<scope>: <url>` and, since v11.23, `<url>: <registry>`.
      // The two shapes cannot be mixed, and an unparseable one is ignored so
      // that it does not cost us the catalogs of the same file.
      registries: Nullish(
        z.union([
          z.record(z.string(), z.string()).transform(withoutEnvVarRegistries),
          z
            .record(z.string(), PnpmRegistry)
            .transform(scopeRoutesFromRegistries),
        ]),
      ).catch(undefined),
    })
    .and(PnpmCatalogs),
);
export type PnpmWorkspaceFile = z.infer<typeof PnpmWorkspaceFile>;

export const PackageManager = z
  .string()
  .transform((val) => val.split('@'))
  .transform(([name, ...version]) => ({ name, version: version.join('@') }));

const DevEngineDependency = z.object({
  name: z.string(),
  version: z.string().optional(),
});

const DevEngine = z.object({
  packageManager: DevEngineDependency.or(
    z.array(DevEngineDependency),
  ).optional(),
});

export const PackageJson = Json.pipe(
  z.object({
    devEngines: DevEngine.optional(),
    engines: LooseRecord(z.string()).optional(),
    dependencies: LooseRecord(z.string()).optional(),
    devDependencies: LooseRecord(z.string()).optional(),
    peerDependencies: LooseRecord(z.string()).optional(),
    packageManager: PackageManager.optional(),
    volta: LooseRecord(z.string()).optional(),
  }),
);

export type PackageJson = z.infer<typeof PackageJson>;

export const PackageLockV3 = z.object({
  lockfileVersion: z.literal(3),
  packages: LooseRecord(
    z
      .string()
      .transform((x) => x.replace(regEx(/^node_modules\//), ''))
      .refine((x) => x.trim() !== ''),
    z.object({ version: z.string() }),
  ),
});

export const PackageLockPreV3 = z
  .object({
    lockfileVersion: z.union([z.literal(2), z.literal(1)]),
    dependencies: LooseRecord(z.object({ version: z.string() })),
  })
  .transform(({ lockfileVersion, dependencies: packages }) => ({
    lockfileVersion,
    packages,
  }));

export const PackageLock = Json.pipe(
  z.union([PackageLockV3, PackageLockPreV3]),
).transform(({ packages, lockfileVersion }) => {
  const lockedVersions: Record<string, string> = {};
  for (const [entry, val] of Object.entries(packages)) {
    lockedVersions[entry] = val.version;
  }
  return { lockedVersions, lockfileVersion };
});
