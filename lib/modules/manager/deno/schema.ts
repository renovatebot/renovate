import validateNpmPackageName from 'validate-npm-package-name';
import { z } from 'zod';
import { regEx } from '../../../util/regex';
import {
  Json,
  Jsonc,
  LooseArray,
  LooseRecord,
} from '../../../util/schema-utils';
import { joinUrlParts } from '../../../util/url';
import { extractJsrPackageName } from '../../datasource/jsr/util';
import { id as denoVersioningId, isValid } from '../../versioning/deno';
import type { PackageDependency } from '../types';
import type { DenoManagerData } from './types';
import { denoLandRegex, depValueRegex } from './utils';

export const DenoLock = Json.pipe(
  // this schema is version 5
  // https://github.com/denoland/vscode_deno/blob/7e125c6ffcdcdebd587f97be5341d404f5335b87/schemas/lockfile.schema.json
  z.object({
    version: z.string(),
    specifiers: LooseRecord(z.string()).catch({}),
    redirects: LooseRecord(z.string()).catch({}),
    remote: LooseRecord(z.string()).catch({}),
  }),
).transform(({ version, specifiers, redirects, remote }) => {
  const lockedVersions: Record<string, string> = {};
  for (const [key, val] of Object.entries(specifiers)) {
    // pick "7.1.3" from "7.1.3_pkgname@4.0.3_@types+pkgname@1.0.1"
    const match = regEx(/^(?<lockedVersion>[^_\s]+)/).exec(val);
    if (match?.groups?.lockedVersion) {
      lockedVersions[key] = match?.groups?.lockedVersion;
    }
  }

  const redirectVersions: Record<string, string> = {};
  for (const [key, val] of Object.entries(redirects)) {
    redirectVersions[key] = val;
  }

  const remoteVersions = new Set<string>();
  for (const key of Object.keys(remote)) {
    remoteVersions.add(key);
  }
  return {
    lockedVersions,
    redirectVersions,
    remoteVersions,
    lockfileVersion: Number(version),
  };
});

export const DenoDependency = z
  .object({
    depValue: z.string(),
    depType: z.string(),
  })
  .transform(({ depValue, depType }): PackageDependency<DenoManagerData> => {
    // deno datasource
    // Check for https://deno.land/x/ URLs first
    const denoLandMatch = denoLandRegex.exec(depValue);
    if (denoLandMatch?.groups?.rawPackageName) {
      return {
        datasource: 'deno',
        depType,
        depName: joinUrlParts(
          'https://deno.land',
          denoLandMatch.groups.rawPackageName,
        ),
        currentValue: denoLandMatch.groups.currentValue,
        // set full URL for getLockedVersion
        currentRawValue: denoLandMatch[0],
      };
    }

    // other datasources

    const match = depValueRegex.exec(depValue);
    if (match?.groups?.datasource && match?.groups.depName) {
      const datasource = match.groups.datasource;
      const depName = match.groups.depName;
      const currentValue = match.groups.currentValue;
      const currentRawValue = match[0];
      // npm datasource
      if (datasource === 'npm') {
        const dep: PackageDependency = {
          datasource,
          versioning: denoVersioningId,
        };

        if (depName && !validateNpmPackageName(depName).validForOldPackages) {
          dep.skipReason = 'invalid-name';
          return dep;
        }

        if (currentValue && !isValid(currentValue)) {
          dep.skipReason = 'invalid-version';
          return dep;
        }
        return {
          ...dep,
          depName,
          currentValue,
          depType,
          currentRawValue,
        };
      }
      // jsr datasource
      if (datasource === 'jsr') {
        const dep: PackageDependency = {
          datasource,
          versioning: denoVersioningId,
        };

        if (depName && !extractJsrPackageName(depName)) {
          dep.skipReason = 'invalid-name';
          return dep;
        }

        if (currentValue && !isValid(currentValue)) {
          dep.skipReason = 'invalid-version';
          return dep;
        }
        return {
          ...dep,
          depName,
          currentValue,
          depType,
          currentRawValue,
        };
      }
    }

    return {
      depType,
      depName: depValue,
      skipStage: 'extract',
      skipReason: 'unsupported',
    };
  });

export const Imports = LooseRecord(z.string())
  .catch({})
  .transform((imports) =>
    Object.values(imports).map((depValue) => ({
      depValue,
      depType: 'imports',
    })),
  )
  .pipe(z.array(DenoDependency));

export const Scopes = LooseRecord(LooseRecord(z.string()))
  .catch({})
  .transform((scopes) =>
    Object.values(scopes).flatMap((scopeDependencies) =>
      Object.values(scopeDependencies).map((depValue) => ({
        depValue,
        depType: 'scopes',
      })),
    ),
  )
  .pipe(z.array(DenoDependency));

/**
 * dependency in `tasks` can't sync lock file updating due to `deno install` is not supported
 */
export const Tasks = LooseRecord(
  z.union([
    z.string().transform((depValue) => ({ depValue, depType: 'tasks' })),
    z.object({ command: z.string() }).transform(({ command }) => ({
      depValue: command,
      depType: 'tasks.command',
    })),
  ]),
)
  .catch({})
  .transform((tasks) =>
    Object.values(tasks).map(({ depValue, depType }) => ({
      depValue,
      depType,
    })),
  )
  .pipe(z.array(DenoDependency));

export const CompilerOptionsTypes = LooseArray(z.string())
  .catch([])
  .transform((types) =>
    types.map((depValue) => ({ depValue, depType: 'compilerOptions.types' })),
  )
  .pipe(z.array(DenoDependency));

export const CompilerOptionsJsxImportSource = z
  .union([
    z
      .string()
      .transform((depValue) => [
        { depValue, depType: 'compilerOptions.jsxImportSource' },
      ]),
    z.undefined().transform(() => []),
  ])
  .pipe(z.array(DenoDependency));

export const CompilerOptionsJsxImportSourceTypes = z
  .union([
    z
      .string()
      .transform((depValue) => [
        { depValue, depType: 'compilerOptions.jsxImportSourceTypes' },
      ]),
    z.undefined().transform(() => []),
  ])
  .pipe(z.array(DenoDependency));

export const Lint = z
  .object({
    plugins: LooseArray(z.string()).catch([]),
  })
  .transform((lint) =>
    lint.plugins.map((depValue) => ({ depValue, depType: 'lint.plugins' })),
  )
  .pipe(z.array(DenoDependency));

export const Lock = z.union([
  z.string().transform((path) => path),
  z.boolean().transform((enabled) => enabled && 'deno.lock'),
  z
    .object({
      path: z.string().optional(),
    })
    .transform((obj) => obj.path),
]);

export const Workspace = z.union([
  z.array(z.string()).transform((workspaces) => workspaces),
  z
    .object({
      members: z.array(z.string()),
    })
    .transform((workspace) => workspace.members),
]);

const DenoPackageFile = z
  .object({
    lock: z.optional(Lock),
    workspace: z.optional(Workspace),
    importMap: z.string().optional(),
    imports: z.optional(Imports).default({}),
    scopes: z.optional(Scopes).default({}),
    tasks: z.optional(Tasks).default({}),
    compilerOptions: z
      .optional(
        z.object({
          types: CompilerOptionsTypes,
          jsxImportSource: CompilerOptionsJsxImportSource,
          jsxImportSourceTypes: CompilerOptionsJsxImportSourceTypes,
        }),
      )
      .default({}),
    lint: z.optional(Lint).default({}),
  })
  .transform(
    ({
      lock,
      imports,
      scopes,
      tasks,
      compilerOptions,
      lint,
      importMap,
      workspace,
    }) => ({
      lock,
      importMap,
      managerData: {
        workspaces: workspace,
      },
      dependencies: [
        ...imports,
        ...scopes,
        ...tasks,
        ...compilerOptions.types,
        ...compilerOptions.jsxImportSource,
        ...compilerOptions.jsxImportSourceTypes,
        ...lint,
      ],
    }),
  );

export const DenoExtract = z.object({
  content: Jsonc.pipe(DenoPackageFile),
  fileName: z.string(),
});
export type DenoExtract = z.infer<typeof DenoExtract>;

export const ImportMapExtract = Json.pipe(
  z.object({
    imports: z.optional(Imports).default({}),
    scopes: z.optional(Scopes).default({}),
  }),
).transform(({ imports, scopes }) => ({
  dependencies: [...imports, ...scopes],
}));
export type ImportMapExtract = z.infer<typeof ImportMapExtract>;

// All object needs passthrough to keep original field of package file and all field should be optional
export const UpdateDenoJsonFile = Jsonc.pipe(
  z
    .object({
      imports: z.record(z.string(), z.string()).optional(),
      scopes: z.record(z.string(), z.record(z.string(), z.string())).optional(),
      tasks: z
        .record(
          z.string(),
          z.union([
            z.string(),
            z.object({ command: z.string().optional() }).passthrough(),
          ]),
        )
        .optional(),
      compilerOptions: z
        .object({
          types: z.array(z.string()).optional(),
          jsxImportSource: z.string().optional(),
          jsxImportSourceTypes: z.string().optional(),
        })
        .passthrough()
        .optional(),
      lint: z
        .object({
          plugins: z.array(z.string()).optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough(),
);
export type UpdateDenoJsonFile = z.infer<typeof UpdateDenoJsonFile>;

// All object needs passthrough to keep original field of package file and all field should be optional
export const UpdateImportMapJsonFile = Json.pipe(
  z
    .object({
      imports: z.record(z.string(), z.string()).optional(),
      scopes: z.record(z.string(), z.record(z.string(), z.string())).optional(),
    })
    .passthrough(),
);
export type UpdateImportMapJsonFile = z.infer<typeof UpdateImportMapJsonFile>;
