import is from '@sindresorhus/is';
import upath from 'upath';
import validateNpmPackageName from 'validate-npm-package-name';
import { logger } from '../../../logger';
import {
  getSiblingFileName,
  localPathIsFile,
  readLocalFile,
} from '../../../util/fs';
import { joinUrlParts } from '../../../util/url';
import { DenoDatasource } from '../../datasource/deno';
import { JsrDatasource } from '../../datasource/jsr';
import { extractJsrPackageName } from '../../datasource/jsr/util';
import { NpmDatasource } from '../../datasource/npm';
import { id as denoVersioningId, isValid } from '../../versioning/deno';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import { extractDenoCompatiblePackageJson } from './compat';
import { postExtract } from './post';
import { DenoJsonFile, ImportMapJsonFile } from './schema';
import type { DenoManagerData } from './types';
import { DENO_LAND_REGEX, DEP_VALUE_REGEX } from './util';
import { detectNodeCompatWorkspaces } from './workspace';

export const supportedDatasources = [
  NpmDatasource.id,
  JsrDatasource.id,
  DenoDatasource.id,
];

const SUPPORTED_DATASOURCES_SET = new Set(supportedDatasources);

export interface DepTypes
  extends Omit<
    Record<keyof DenoJsonFile, string>,
    'name' | 'version' | 'workspace'
  > {}

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
): Promise<PackageFile<DenoManagerData>[]> {
  logger.trace(`deno.extractDenoJsonFile(${matchedFile})`);
  const packageFile: PackageFile<DenoManagerData> = {
    deps: [],
    packageFile: matchedFile,
  };
  const { deps } = packageFile;

  if (denoJson.version) {
    packageFile.packageFileVersion = denoJson.version;
  }
  if (denoJson.name) {
    packageFile.managerData = {
      packageName: denoJson.name,
    };
  }
  if (denoJson.workspace) {
    const ws = denoJson.workspace;
    const workspace = 'members' in ws ? ws.members : ws;
    if (is.emptyArray(workspace)) {
      logger.debug(
        { fileName: matchedFile, depType: 'workspace' },
        'No workspace members found',
      );
    }
    packageFile.managerData = {
      workspaces: workspace,
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

  let importMapPackageFile: PackageFile<DenoManagerData> | null = null;

  // importMap field is ignored when imports or scopes are specified in the config file
  // https://github.com/denoland/deno/blob/b7061b0f64b3c79b312de5a59122b7184b2fdef2/libs/config/workspace/mod.rs#L150
  const hasImportsOrScopes = packageFile.deps.some(
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
        importMapPackageFile = {
          deps: [],
          packageFile: importMapPath,
        };
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
            // SAFETY: initialized above
            importMapPackageFile!.deps.push(dep);
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
              // SAFETY: initialized above
              importMapPackageFile!.deps.push(dep);
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

  const lockFiles = lockFile ? [lockFile] : [];
  const packageFiles: PackageFile<DenoManagerData>[] = [
    {
      ...packageFile,
      lockFiles,
    },
  ];
  if (importMapPackageFile) {
    packageFiles.push({
      ...importMapPackageFile,
      lockFiles,
    });
  }

  return packageFiles;
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
      packageFiles.push(...extracted);
    }
  }

  await postExtract(packageFiles);
  return packageFiles;
}
