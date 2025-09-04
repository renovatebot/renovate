import is from '@sindresorhus/is';
import { Minimatch } from 'minimatch';
import upath from 'upath';
import validateNpmPackageName from 'validate-npm-package-name';
import { logger } from '../../../logger';
import {
  getSiblingFileName,
  localPathIsFile,
  readLocalFile,
} from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { joinUrlParts } from '../../../util/url';
import { DenoDatasource } from '../../datasource/deno';
import { JsrDatasource } from '../../datasource/jsr';
import { extractJsrPackageName } from '../../datasource/jsr/util';
import { NpmDatasource } from '../../datasource/npm';
import {
  id as denoVersioningId,
  isValid,
  api as semver,
} from '../../versioning/deno';
import { extractPackageJson } from '../npm/extract/common/package-file';
import type { NpmPackage } from '../npm/extract/types';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import { DenoJsonFile, DenoLock, ImportMapJsonFile } from './schema';
import type { DenoManagerData, LockFile } from './types';
import { detectNodeCompatWorkspaces } from './workspace';

export const supportedDatasources = [
  NpmDatasource.id,
  JsrDatasource.id,
  DenoDatasource.id,
];

const DENO_LAND_REGEX = regEx(
  /(https:\/\/deno.land\/)(?<rawPackageName>[^@\s]+)(?:@(?<currentValue>[^/\s]+))?(?<filePath>\/[^\s]*)?/,
);
// "deno task" could refer to another task e.g. "deno task npm:build"
const DEP_VALUE_REGEX = regEx(
  /(?:deno task\s+\w+:[^\s]+)|(?<datasource>\w+):\/?(?<depName>@?[\w-]+(?:\/[\w-]+)?)(?:@(?<currentValue>[^\s/]+))?\/?/,
);

const SUPPORTED_DATASOURCES_SET = new Set(supportedDatasources);

export interface DepTypes
  extends Omit<
    Record<keyof DenoJsonFile, string>,
    'name' | 'version' | 'workspace'
  > {}

export async function getDenoLock(filePath: string): Promise<LockFile> {
  const lockfileContent = await readLocalFile(filePath, 'utf8');
  if (!lockfileContent) {
    logger.debug({ filePath }, 'Deno: unable to read lockfile');
    return { lockedVersions: {} };
  }
  const parsedLockfile = DenoLock.safeParse(lockfileContent);
  if (!parsedLockfile.success) {
    logger.debug(
      { filePath, err: parsedLockfile.error },
      'Deno: unable to parse lockfile',
    );
    return { lockedVersions: {} };
  }
  if (parsedLockfile.data.lockfileVersion < 5) {
    logger.warn(
      { filePath },
      `Deno: unsupported lockfile version. Please update ${filePath} on your own.`,
    );
    return { lockedVersions: {} };
  }

  return parsedLockfile.data;
}

export function getLockedVersion(
  deps: PackageDependency<DenoManagerData>,
  lockFileContent: LockFile,
): string | undefined | null {
  if (is.emptyObject(lockFileContent)) {
    return null;
  }
  const { datasource, currentRawValue, currentValue, depName } = deps;

  // deno datasource
  if (datasource === 'deno') {
    // "remote": {
    //   "https://deno.land/std@0.223.0/fs/mod.ts": "c25e6802cbf27f3050f60b26b00c2d8dba1cb7fcdafe34c66006a7473b7b34d4",
    // },
    if (
      lockFileContent.remoteVersions &&
      lockFileContent.remoteVersions.size > 0 &&
      currentRawValue &&
      lockFileContent.remoteVersions.has(currentRawValue)
    ) {
      const match = DENO_LAND_REGEX.exec(currentRawValue);
      return match?.groups?.currentValue;
    }

    // "redirects": {
    //   "https://deno.land/std": "https://deno.land/std@0.224.0"
    // },
    const key =
      currentValue && depName ? `${depName}@${currentValue}` : depName;
    if (
      lockFileContent.redirectVersions &&
      lockFileContent.redirectVersions.size > 0 &&
      key &&
      lockFileContent.redirectVersions.has(key)
    ) {
      const match = DENO_LAND_REGEX.exec(
        // SAFETY: checked above
        lockFileContent.redirectVersions.get(key)!,
      );
      return match?.groups?.currentValue;
    }
  }

  // jsr and npm datasource
  if (datasource === 'jsr' || datasource === 'npm') {
    if (
      !lockFileContent.lockedVersions ||
      is.emptyObject(lockFileContent.lockedVersions)
    ) {
      return null;
    }

    // find "jsr:@scope/name@1.2.3" from "jsr:@scope/name@1.2.3"
    if (currentRawValue && lockFileContent.lockedVersions[currentRawValue]) {
      return lockFileContent.lockedVersions[currentRawValue];
    }

    // find "jsr:@scope/name@*" from "jsr:@scope/name"
    if (
      currentRawValue &&
      lockFileContent.lockedVersions[`${currentRawValue}@*`]
    ) {
      return lockFileContent.lockedVersions[`${currentRawValue}@*`];
    }

    for (const [key, value] of Object.entries(lockFileContent.lockedVersions)) {
      const match = DEP_VALUE_REGEX.exec(key);
      // find "jsr:@scope/name@1" intersects "jsr:@scope/name@^1.0.0"
      if (
        typeof depName === 'string' &&
        match?.groups?.depName === depName &&
        match?.groups?.datasource === datasource &&
        currentValue &&
        match?.groups?.currentValue &&
        // SAFETY: npm semver define it
        semver.intersects!(match.groups.currentValue, currentValue)
      ) {
        return value;
      }
      continue;
    }
    return null;
  }

  return null;
}

export function extractNpmDatasource(
  datasource: (typeof supportedDatasources)[0],
  depType: keyof DepTypes,
  depName?: string,
  currentValue?: string,
  currentRawValue?: string,
): PackageDependency {
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

export function extractJsrDatasource(
  datasource: (typeof supportedDatasources)[1],
  depType: keyof DepTypes,
  depName?: string,
  currentValue?: string,
  currentRawValue?: string,
): PackageDependency {
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

function extractDenoDatasource(
  depType: keyof DepTypes,
  depName?: string,
  currentValue?: string,
  currentRawValue?: string,
): PackageDependency {
  return {
    datasource: 'deno',
    depName,
    currentValue,
    depType,
    currentRawValue,
  };
}

export function getDenoDependency(
  depValue: string,
  depType: keyof DepTypes,
  datasources = SUPPORTED_DATASOURCES_SET,
): PackageDependency | null {
  // Check for https://deno.land/x/ URLs first
  const denoLandMatch = DENO_LAND_REGEX.exec(depValue);
  if (denoLandMatch?.groups?.rawPackageName) {
    return extractDenoDatasource(
      depType,
      joinUrlParts('https://deno.land', denoLandMatch.groups.rawPackageName),
      denoLandMatch.groups.currentValue,
      // set full URL for getLockedVersion
      denoLandMatch[0],
    );
  }

  if (
    depType !== 'importMap' &&
    depType !== 'imports' &&
    depType !== 'scopes' &&
    depType !== 'compilerOptions' &&
    depType !== 'lint' &&
    depType !== 'tasks'
  ) {
    return null;
  }

  const match = DEP_VALUE_REGEX.exec(depValue);
  if (match?.groups?.datasource && match?.groups.depName) {
    const datasource = match.groups.datasource;
    if (!datasources.has(datasource)) {
      return null;
    }

    if (datasource === 'npm') {
      return extractNpmDatasource(
        datasource,
        depType,
        match.groups.depName,
        match.groups.currentValue,
        match[0],
      );
    }
    if (datasource === 'jsr') {
      return extractJsrDatasource(
        datasource,
        depType,
        match.groups.depName,
        match.groups.currentValue,
        match[0],
      );
    }
  }

  return null;
}

export async function extractDenoJsonFile(
  denoJson: DenoJsonFile,
  matchedFile: string,
): Promise<PackageFile<DenoManagerData>> {
  logger.trace(`deno.extractDenoJsonFile(${matchedFile})`);
  const result: PackageFile<DenoManagerData> = {
    deps: [],
    packageFile: matchedFile,
  };
  const { deps } = result;

  let isWorkspacePackage = false;
  // https://docs.deno.com/runtime/fundamentals/workspaces/
  const dependencies = denoJson.workspace;
  if (dependencies) {
    const ws = dependencies as NonNullable<DenoJsonFile['workspace']>;
    const workspace = 'members' in ws ? ws.members : ws;
    if (is.emptyArray(workspace)) {
      logger.debug(
        { fileName: matchedFile, depType: 'workspace' },
        'No workspace members found',
      );
    }
    result.managerData = {
      workspaces: workspace,
    };
    isWorkspacePackage = true;
  }

  if (!isWorkspacePackage) {
    result.packageFileVersion = denoJson.version;
    result.managerData = {
      packageName: denoJson.name,
    };
  }

  let lockFile: string | undefined;

  if (denoJson.lock) {
    const lock = denoJson.lock;
    // "lock": "deno.lock"
    if (typeof lock === 'string' && (await localPathIsFile(lock))) {
      lockFile = lock;
    }

    // "lock": boolean
    // check sibling lock file below this function if "lock": true

    // "lock": { "path": "my-deno.lock" }
    if (
      typeof lock !== 'string' &&
      typeof lock !== 'boolean' &&
      'path' in lock &&
      lock.path &&
      (await localPathIsFile(lock.path))
    ) {
      lockFile = lock.path;
    }
  }

  if (denoJson.imports) {
    const imports = denoJson.imports;
    for (const depKey in imports) {
      const depValue = imports[depKey];
      const dep = getDenoDependency(depValue, 'imports');
      if (dep) {
        deps.push(dep);
      }
    }
  }

  if (denoJson.scopes) {
    const scopes = denoJson.scopes;
    for (const scopeKey in scopes) {
      const scopeDependencies = scopes[scopeKey];
      for (const depKey in scopeDependencies) {
        const depValue = scopeDependencies[depKey];
        const dep = getDenoDependency(depValue, 'scopes');
        if (dep) {
          deps.push(dep);
        }
      }
    }
  }

  // importMap field is ignored when imports or scopes are specified in the config file
  // https://github.com/denoland/deno/blob/b7061b0f64b3c79b312de5a59122b7184b2fdef2/libs/config/workspace/mod.rs#L150
  const hasImportsOrScopes = result.deps.some(
    (d) => d.depType === 'imports' || d.depType === 'scopes',
  );
  if (!hasImportsOrScopes && denoJson.importMap) {
    const importMapPath = denoJson.importMap;

    // skip due to remote importMap can't update
    if (importMapPath.startsWith('http')) {
      logger.debug({ matchedFile }, `Remote ${importMapPath} found`);
    } // local importMap
    else {
      const importMap = await readLocalFile(importMapPath, 'utf8');
      if (!importMap) {
        logger.debug({ matchedFile }, `No ${importMapPath} found`);
      }

      let importMapJson: ImportMapJsonFile | null = null;
      try {
        importMapJson = ImportMapJsonFile.parse(importMap);
        // set importMap path as packageFile
        result.packageFile = importMapPath;
      } catch (err) {
        logger.error({ err }, `Error parsing ${importMapPath}`);
      }

      // imports
      const imports = importMapJson?.imports;
      if (imports) {
        for (const depKey in imports) {
          const depValue = imports[depKey];
          const dep = getDenoDependency(depValue, 'imports');
          if (dep) {
            deps.push(dep);
          }
        }
      }

      // scopes
      const scopes = importMapJson?.scopes;
      if (scopes) {
        for (const scopeKey in scopes) {
          const scopeDependencies = scopes[scopeKey];
          for (const depKey in scopeDependencies) {
            const depValue = scopeDependencies[depKey];
            const dep = getDenoDependency(depValue, 'scopes');
            if (dep) {
              deps.push(dep);
            }
          }
        }
      }
    }
  }

  if (denoJson.tasks) {
    const tasksObj = denoJson.tasks;
    for (const taskKey in tasksObj) {
      const tasksValue = tasksObj[taskKey];
      if (typeof tasksValue === 'string') {
        const dep = getDenoDependency(tasksValue, 'tasks');
        if (dep) {
          deps.push(dep);
        }
      } else if (tasksValue && 'command' in tasksValue && tasksValue.command) {
        // e.g. tasks: { build: { command: 'deno run -A npm:vite build' } }
        const dep = getDenoDependency(tasksValue.command, 'tasks');
        if (dep) {
          deps.push(dep);
        }
      }
    }
  }

  if (denoJson.compilerOptions) {
    const compilerOptions = denoJson.compilerOptions;
    if ('types' in compilerOptions && compilerOptions.types) {
      for (const depValue of compilerOptions.types) {
        const dep = getDenoDependency(depValue, 'compilerOptions');
        if (dep) {
          deps.push(dep);
        }
      }
    }
    if (
      'jsxImportSource' in compilerOptions &&
      compilerOptions.jsxImportSource
    ) {
      const depValue = compilerOptions.jsxImportSource;
      const dep = getDenoDependency(depValue, 'compilerOptions');
      if (dep) {
        deps.push(dep);
      }
    }
    if (
      'jsxImportSourceTypes' in compilerOptions &&
      compilerOptions.jsxImportSourceTypes
    ) {
      const depValue = compilerOptions.jsxImportSourceTypes;
      const dep = getDenoDependency(depValue, 'compilerOptions');
      if (dep) {
        deps.push(dep);
      }
    }
  }

  // https://docs.deno.com/runtime/reference/lint_plugins/#example-plugin
  if (denoJson.lint) {
    const lint = denoJson.lint;
    if ('plugins' in lint && lint.plugins) {
      for (const depValue of lint.plugins) {
        const dep = getDenoDependency(depValue, 'lint');
        if (dep) {
          deps.push(dep);
        }
      }
    }
  }

  if (!lockFile) {
    // check sibling lock file
    const siblingLockFile = getSiblingFileName(matchedFile, 'deno.lock');
    if (await localPathIsFile(siblingLockFile)) {
      lockFile = siblingLockFile;
    }
  }

  return {
    ...result,
    lockFiles: lockFile ? [lockFile] : [],
  };
}

export async function extractDenoCompatiblePackageJson(
  matchedFile: string,
): Promise<PackageFile<DenoManagerData> | null> {
  const packageFileContent = await readLocalFile(matchedFile, 'utf8');
  if (!packageFileContent) {
    logger.debug({ packageFile: matchedFile }, 'Deno: No package.json found');
    return null;
  }

  let packageJson: NpmPackage;
  try {
    packageJson = JSON.parse(packageFileContent);
  } catch (err) {
    logger.error({ err }, 'Error parsing package.json');
    return null;
  }

  const extracted = extractPackageJson(packageJson, matchedFile);
  if (!extracted) {
    return null;
  }

  for (const dep of extracted.deps) {
    if (!dep.currentRawValue) {
      continue;
    }

    // https://github.com/denoland/deno_npm/blob/722fbecb5bdbd93241e5fc774cc1deaebd40365b/src/registry.rs#L289-L297
    if (
      dep.currentRawValue?.startsWith('https://') ||
      dep.currentRawValue?.startsWith('http://') ||
      dep.currentRawValue?.startsWith('git:') ||
      dep.currentRawValue?.startsWith('github:') ||
      dep.currentRawValue?.startsWith('git+')
    ) {
      dep.skipReason = 'unsupported-remote';
    }
  }

  const res: PackageFile<DenoManagerData> = {
    ...extracted,
    managerData: {
      packageName: extracted.managerData?.packageJsonName,
      workspaces: extracted.managerData?.workspaces,
    },
    packageFile: matchedFile,
  };
  return res;
}

export async function collectPackageJson(
  lockFile: string,
): Promise<PackageFile<DenoManagerData>[] | null> {
  const lockFiles = [lockFile];
  const packageFiles: PackageFile<DenoManagerData>[] = [];
  const rootPackageJson = getSiblingFileName(lockFile, 'package.json');
  const rootPackageFile =
    await extractDenoCompatiblePackageJson(rootPackageJson);
  if (rootPackageFile) {
    const pkg = {
      ...rootPackageFile,
      lockFiles,
    };

    // detect node compat workspaces
    const result = await detectNodeCompatWorkspaces(pkg);
    if (!result) {
      return null;
    }
    const { workspaces, packagePaths } = result;
    pkg.managerData = {
      ...pkg.managerData,
      // override workspace
      workspaces,
    };
    packageFiles.push(pkg);

    for (const packagePath of packagePaths) {
      const packageFile = await extractDenoCompatiblePackageJson(packagePath);
      if (packageFile) {
        const pkg = {
          ...packageFile,
          lockFiles,
        };
        packageFiles.push(pkg);
      }
    }
  }

  // NOTE: a deno.json/jsonc exists in "links" should be ignored?
  // https://github.com/denoland/deno/pull/29677

  return packageFiles;
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  matchedFiles: string[],
): Promise<PackageFile<DenoManagerData>[]> {
  const packageFiles: PackageFile<DenoManagerData>[] = [];

  for (const matchedFile of matchedFiles) {
    if (upath.basename(matchedFile) === 'deno.lock') {
      // node-compat
      const extracted = await collectPackageJson(matchedFile);
      if (extracted) {
        packageFiles.push(...extracted);
      }
    }

    // deno.json or deno.jsonc
    if (upath.basename(matchedFile).startsWith('deno.json')) {
      const packageFileContent = await readLocalFile(matchedFile, 'utf8');

      let denoJson: DenoJsonFile;
      try {
        denoJson = DenoJsonFile.parse(packageFileContent);
      } catch (err) {
        logger.error({ err }, `Error parsing ${matchedFile}`);
        continue;
      }

      const extracted = await extractDenoJsonFile(denoJson, matchedFile);
      packageFiles.push(extracted);
    }
  }

  // imports and scopes field is ignored when importMap is specified in the root config file
  // https://github.com/denoland/deno/blob/b7061b0f64b3c79b312de5a59122b7184b2fdef2/libs/config/workspace/mod.rs#L154

  // Find a deno workspace root that has importMap
  const workspaceRootsWithImportMap = packageFiles.filter(
    (pkg) =>
      is.nonEmptyArray(pkg.managerData?.workspaces) &&
      !upath.basename(pkg.packageFile).startsWith('deno.json') &&
      pkg.deps.some((d) => d.depType === 'imports' || d.depType === 'scopes'),
  );
  for (const workspaceRootWithImportMap of workspaceRootsWithImportMap) {
    for (const pkg of packageFiles) {
      if (workspaceRootWithImportMap.packageFile === pkg.packageFile) {
        continue;
      }
      pkg.deps = pkg.deps.filter(
        (dep) => dep.depType !== 'imports' && dep.depType !== 'scopes',
      );
    }
  }

  // detect package.json as members of a deno workspace
  const workspaceRoots = packageFiles.filter(
    (pkg) =>
      is.nonEmptyArray(pkg.managerData?.workspaces) &&
      upath.basename(pkg.packageFile).startsWith('deno.json'),
  );
  for (const workspaceRoot of workspaceRoots) {
    const result = await detectNodeCompatWorkspaces(workspaceRoot);
    /* v8 ignore next 3: hard to test */
    if (!result) {
      continue;
    }
    const { packagePaths } = result;
    for (const packagePath of packagePaths) {
      const packageFile = await extractDenoCompatiblePackageJson(packagePath);
      if (packageFile) {
        const pkg = {
          ...packageFile,
          lockFiles: workspaceRoot.lockFiles,
        };
        packageFiles.push(pkg);
      }
    }
  }

  // determine workspace root to collect lock files of workspace members
  const workspaceContexts: {
    workspaces: string[];
    lockFiles?: string[];
    rootDir: string;
    matchers?: { pattern: string; matcher: Minimatch }[];
  }[] = [];
  for (const pkg of packageFiles) {
    const workspaces = pkg.managerData?.workspaces;
    if (
      workspaces &&
      is.nonEmptyArray(workspaces) &&
      is.nonEmptyArray(pkg.lockFiles)
    ) {
      const rootDir = upath.dirname(pkg.packageFile);
      const matchers = workspaces.map((pattern) => ({
        pattern,
        matcher: new Minimatch(pattern, { dot: true }),
      }));
      workspaceContexts.push({
        workspaces,
        lockFiles: pkg.lockFiles,
        rootDir,
        matchers,
      });
    }
  }
  // apply lock files to workspace members from their root
  for (const pkg of packageFiles) {
    const workspaces = pkg.managerData?.workspaces;
    if (
      workspaces &&
      is.nonEmptyArray(workspaces) &&
      is.nonEmptyArray(pkg.lockFiles)
    ) {
      continue;
    }

    for (const context of workspaceContexts) {
      const { rootDir, matchers, lockFiles } = context;
      const pkgRelativePath = upath.relative(rootDir, pkg.packageFile);
      const pkgDir = upath.dirname(pkgRelativePath);
      for (const { matcher } of matchers!) {
        if (matcher.match(pkgDir)) {
          pkg.lockFiles = lockFiles;
          break;
        }
      }

      if (pkg.lockFiles) {
        break;
      }
    }
  }

  // apply locked versions from lock files
  // use cache to avoid reading the same lock file multiple times
  const lockFileCache = new Map<string, LockFile>();
  for (const pkg of packageFiles) {
    if (is.nonEmptyArray(pkg.lockFiles)) {
      const lockFile = pkg.lockFiles[0];
      let lockFileContent: LockFile;

      if (lockFileCache.has(lockFile)) {
        lockFileContent = lockFileCache.get(lockFile)!;
      } else {
        lockFileContent = await getDenoLock(lockFile);
        lockFileCache.set(lockFile, lockFileContent);
      }

      const withLockedVersionDeps = pkg.deps.map((dep) => {
        const lockedVersion = getLockedVersion(dep, lockFileContent);
        return lockedVersion
          ? {
              ...dep,
              lockedVersion,
            }
          : dep;
      });

      pkg.deps = withLockedVersionDeps;
    }
  }

  return packageFiles;
}
