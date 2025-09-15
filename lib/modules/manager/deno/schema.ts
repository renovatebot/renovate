import validateNpmPackageName from 'validate-npm-package-name';
import { z } from 'zod';
import { logger } from '../../../logger';
import {
  getSiblingFileName,
  localPathIsFile,
  readLocalFile,
} from '../../../util/fs';
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
import type { PackageDependency, PackageFile } from '../types';
import type { DenoManagerData } from './types';
import { denoLandRegex, depValueRegex } from './utils';

// https://github.com/denoland/deno/blob/410c66ad0d1ce8a5a3b1a2f06c932fb66f25a3c6/cli/schemas/config-file.v1.json
export interface DenoJsonFile {
  name?: string;
  version?: string;
  lock?: string | boolean | { path?: string };
  imports?: Record<string, string>;
  scopes?: Record<string, Record<string, string>>;
  importMap?: string;
  tasks?: Record<string, string | { command?: string }>;
  compilerOptions?: {
    types?: string[];
    jsxImportSource?: string;
    jsxImportSourceTypes?: string;
  };
  lint?: {
    plugins?: string[];
  };
  workspace?: string[] | { members: string[] };
}

export interface DepTypes
  extends Omit<
    Record<keyof DenoJsonFile, string>,
    'name' | 'version' | 'workspace'
  > {}

export interface ImportMapJsonFile
  extends Pick<DenoJsonFile, 'imports' | 'scopes'> {}

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

export const Workspace = z
  .union([
    z.array(z.string()),
    z.object({
      members: z.array(z.string()),
    }),
  ])
  .optional()
  .transform((workspaces): string[] | undefined => {
    if (!workspaces) {
      return undefined;
    }
    return 'members' in workspaces ? workspaces.members : workspaces;
  })
  .transform((workspaces): DenoManagerData => ({ workspaces }));

export const Imports = LooseRecord(z.string())
  .catch({})
  .transform((imports): PackageDependency<DenoManagerData>[] => {
    const deps = [];
    for (const depValue of Object.values(imports)) {
      const dep = DenoDependency.parse({ depValue, depType: 'imports' });
      deps.push(dep);
    }
    return deps;
  });

export const Scopes = LooseRecord(LooseRecord(z.string()).catch({}))
  .catch({})
  .transform((scopes): PackageDependency<DenoManagerData>[] => {
    const deps = [];
    for (const scopeDependencies of Object.values(scopes)) {
      for (const depValue of Object.values(scopeDependencies)) {
        const dep = DenoDependency.parse({ depValue, depType: 'scopes' });
        deps.push(dep);
      }
    }
    return deps;
  });

/**
 * dependency in `tasks` can't sync lock file updating due to `deno install` is not supported
 */
export const Tasks = LooseRecord(
  z.union([z.string(), z.object({ command: z.string().optional() })]),
)
  .catch({})
  .transform((tasks): PackageDependency<DenoManagerData>[] => {
    const deps = [];
    for (const taskValue of Object.values(tasks)) {
      const depValue =
        typeof taskValue === 'string' ? taskValue : taskValue.command;
      if (depValue) {
        const dep = DenoDependency.parse({ depValue, depType: 'tasks' });
        deps.push(dep);
      }
    }
    return deps;
  });

export const CompilerOptions = z
  .object({
    types: LooseArray(z.string()).catch([]),
    jsxImportSource: z.string().optional(),
    jsxImportSourceTypes: z.string().optional(),
  })
  .transform((compilerOptions): PackageDependency<DenoManagerData>[] => {
    const deps = [];

    for (const depValue of compilerOptions.types) {
      const dep = DenoDependency.parse({
        depValue,
        depType: 'compilerOptions',
      });
      deps.push(dep);
    }

    if (compilerOptions.jsxImportSource) {
      const dep = DenoDependency.parse({
        depValue: compilerOptions.jsxImportSource,
        depType: 'compilerOptions',
      });
      deps.push(dep);
    }

    if (compilerOptions.jsxImportSourceTypes) {
      const dep = DenoDependency.parse({
        depValue: compilerOptions.jsxImportSourceTypes,
        depType: 'compilerOptions',
      });
      deps.push(dep);
    }

    return deps;
  });

export const Lint = z
  .object({
    plugins: LooseArray(z.string()).catch([]),
  })
  .transform((lint): PackageDependency<DenoManagerData>[] => {
    const deps = [];
    for (const depValue of lint.plugins) {
      const dep = DenoDependency.parse({ depValue, depType: 'lint' });
      deps.push(dep);
    }
    return deps;
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

export const ImportMap = Json.pipe(
  z.object({
    imports: z.optional(Imports).default({}),
    scopes: z.optional(Scopes).default({}),
  }),
);
export type ImportMap = z.infer<typeof ImportMap>;

// https://github.com/denoland/deno/blob/410c66ad0d1ce8a5a3b1a2f06c932fb66f25a3c6/cli/schemas/config-file.v1.json
export const DenoPackageFile = z
  .object({
    name: z.string().optional(),
    version: z.string().optional(),
    lock: z
      .union([
        z.string(),
        z.boolean(),
        z.object({
          path: z.string().optional(),
        }),
      ])
      .optional(),
    imports: z.optional(Imports).default({}),
    scopes: z.optional(Scopes).default({}),
    importMap: z.string().optional(),
    tasks: z.optional(Tasks).default({}),
    compilerOptions: z.optional(CompilerOptions).default({}),
    lint: z.optional(Lint).default({}),
    workspace: Workspace,
  })
  .transform(
    ({
      name,
      version,
      lock,
      imports,
      scopes,
      tasks,
      compilerOptions,
      lint,
      importMap,
      workspace,
    }) => ({
      version,
      lock,
      importMap,
      managerData: {
        workspaces: workspace?.workspaces,
        packageName: name,
      },
      dependencies: [
        ...imports,
        ...scopes,
        ...tasks,
        ...compilerOptions,
        ...lint,
      ],
    }),
  );
export type DenoPackageFile = z.infer<typeof DenoPackageFile>;

export const DenoExtract = z
  .object({
    content: Jsonc.pipe(DenoPackageFile),
    fileName: z.string(),
  })
  .transform(async ({ content, fileName }) => {
    let lockFile: string | undefined;

    if (content.lock) {
      const lock = content.lock;
      if (typeof lock === 'string' && (await localPathIsFile(lock))) {
        lockFile = lock;
      } else if (
        typeof lock !== 'string' &&
        typeof lock !== 'boolean' &&
        'path' in lock &&
        lock.path &&
        (await localPathIsFile(lock.path))
      ) {
        lockFile = lock.path;
      }
    }

    if (!lockFile) {
      const siblingLockFile = getSiblingFileName(fileName, 'deno.lock');
      if (await localPathIsFile(siblingLockFile)) {
        lockFile = siblingLockFile;
      }
    }

    return { content, fileName, lockFile };
  })
  .transform(async ({ content, fileName, lockFile }) => {
    const packageFile: PackageFile<DenoManagerData> = {
      deps: content.dependencies,
      packageFile: fileName,
      packageFileVersion: content.version,
      managerData: content.managerData,
    };

    let importMapPackageFile: PackageFile<DenoManagerData> | null = null;
    // importMap field is ignored when imports or scopes are specified in the config file
    // https://github.com/denoland/deno/blob/b7061b0f64b3c79b312de5a59122b7184b2fdef2/libs/config/workspace/mod.rs#L150
    const hasImportsOrScopes = content.dependencies.some(
      (d) => d.depType === 'imports' || d.depType === 'scopes',
    );
    if (!hasImportsOrScopes && content.importMap) {
      const importMapPath = content.importMap;
      if (!importMapPath.startsWith('http')) {
        const importMap = await readLocalFile(importMapPath, 'utf8');
        if (importMap) {
          try {
            const importMapJson = ImportMap.parse(importMap);
            const importMapDeps: PackageDependency[] = [];

            importMapDeps.push(...importMapJson.imports);
            importMapDeps.push(...importMapJson.scopes);

            importMapPackageFile = {
              deps: importMapDeps,
              packageFile: importMapPath,
            };
          } catch (err) {
            logger.error({ err }, `Error parsing ${importMapPath}`);
          }
        }
      }
    }

    const lockFiles = lockFile ? [lockFile] : [];
    const packageFiles = [{ ...packageFile, lockFiles }];
    if (importMapPackageFile) {
      packageFiles.push({ ...importMapPackageFile, lockFiles });
    }

    return packageFiles;
  });
export type DenoExtract = z.infer<typeof DenoExtract>;
