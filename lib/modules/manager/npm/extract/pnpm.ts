import is from '@sindresorhus/is';
import { findPackages } from 'find-packages';
import upath from 'upath';
import type { z } from 'zod';
import { GlobalConfig } from '../../../../config/global';
import { logger } from '../../../../logger';
import {
  findLocalSiblingOrParent,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../../util/fs';
import { parseSingleYaml } from '../../../../util/yaml';
import type {
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../../types';
import type { PnpmDependencySchema, PnpmLockFile } from '../post-update/types';
import type { PnpmCatalogsSchema } from '../schema';
import { PnpmWorkspaceFileSchema } from '../schema';
import type { NpmManagerData } from '../types';
import { extractDependency, parseDepName } from './common/dependency';
import type { LockFile, PnpmCatalog, PnpmWorkspaceFile } from './types';

function isPnpmLockfile(obj: any): obj is PnpmLockFile {
  return is.plainObject(obj) && 'lockfileVersion' in obj;
}

export async function extractPnpmFilters(
  fileName: string,
): Promise<string[] | undefined> {
  try {
    // TODO: use schema (#9610,#22198)
    const contents = parseSingleYaml<PnpmWorkspaceFile>(
      (await readLocalFile(fileName, 'utf8'))!,
    );
    if (
      !Array.isArray(contents.packages) ||
      !contents.packages.every((item) => is.string(item))
    ) {
      logger.trace(
        { fileName },
        'Failed to find required "packages" array in pnpm-workspace.yaml',
      );
      return undefined;
    }
    return contents.packages;
  } catch (err) {
    logger.trace({ fileName, err }, 'Failed to parse pnpm-workspace.yaml');
    return undefined;
  }
}

export async function findPnpmWorkspace(
  packageFile: string,
): Promise<{ lockFilePath: string; workspaceYamlPath: string } | null> {
  // search for pnpm-workspace.yaml
  const workspaceYamlPath = await findLocalSiblingOrParent(
    packageFile,
    'pnpm-workspace.yaml',
  );
  if (!workspaceYamlPath) {
    logger.trace(
      { packageFile },
      'Failed to locate pnpm-workspace.yaml in a parent directory.',
    );
    return null;
  }

  // search for pnpm-lock.yaml next to pnpm-workspace.yaml
  const pnpmLockfilePath = getSiblingFileName(
    workspaceYamlPath,
    'pnpm-lock.yaml',
  );
  if (!(await localPathExists(pnpmLockfilePath))) {
    logger.trace(
      { workspaceYamlPath, packageFile },
      'Failed to find a pnpm-lock.yaml sibling for the workspace.',
    );
    return null;
  }

  return {
    lockFilePath: pnpmLockfilePath,
    workspaceYamlPath,
  };
}

export async function detectPnpmWorkspaces(
  packageFiles: Partial<PackageFile<NpmManagerData>>[],
): Promise<void> {
  logger.debug(`Detecting pnpm Workspaces`);
  const packagePathCache = new Map<string, string[] | null>();

  for (const p of packageFiles) {
    const { packageFile, managerData } = p;
    const pnpmShrinkwrap = managerData?.pnpmShrinkwrap;

    // check if pnpmShrinkwrap-file has already been provided
    if (pnpmShrinkwrap) {
      logger.trace(
        { packageFile, pnpmShrinkwrap },
        'Found an existing pnpm shrinkwrap file; skipping pnpm monorepo check.',
      );
      continue;
    }

    // search for corresponding pnpm workspace
    // TODO #22198
    const pnpmWorkspace = await findPnpmWorkspace(packageFile!);
    if (pnpmWorkspace === null) {
      continue;
    }
    const { workspaceYamlPath, lockFilePath } = pnpmWorkspace;

    // check if package matches workspace filter
    if (!packagePathCache.has(workspaceYamlPath)) {
      const filters = await extractPnpmFilters(workspaceYamlPath);
      const localDir = GlobalConfig.get('localDir');
      const packages = await findPackages(
        upath.dirname(upath.join(localDir, workspaceYamlPath)),
        {
          patterns: filters,
          // Match the ignores used in @pnpm/find-workspace-packages
          ignore: ['**/node_modules/**', '**/bower_components/**'],
        },
      );
      const packagePaths = packages.map((pkg) =>
        upath.join(pkg.dir, 'package.json'),
      );
      packagePathCache.set(workspaceYamlPath, packagePaths);
    }
    const packagePaths = packagePathCache.get(workspaceYamlPath);

    const isPackageInWorkspace = packagePaths?.some((p) =>
      p.endsWith(packageFile!),
    );

    if (isPackageInWorkspace) {
      p.managerData ??= {};
      p.managerData.pnpmShrinkwrap = lockFilePath;
    } else {
      logger.trace(
        { packageFile, workspaceYamlPath },
        `Didn't find the package in the pnpm workspace`,
      );
    }
  }
}

export async function getPnpmLock(filePath: string): Promise<LockFile> {
  try {
    const pnpmLockRaw = await readLocalFile(filePath, 'utf8');
    if (!pnpmLockRaw) {
      throw new Error('Unable to read pnpm-lock.yaml');
    }

    const lockParsed = parseSingleYaml(pnpmLockRaw);
    if (!isPnpmLockfile(lockParsed)) {
      throw new Error('Invalid or empty lockfile');
    }
    logger.trace({ lockParsed }, 'pnpm lockfile parsed');

    // field lockfileVersion is type string in lockfileVersion = 6 and type number in < 6
    const lockfileVersion: number = is.number(lockParsed.lockfileVersion)
      ? lockParsed.lockfileVersion
      : parseFloat(lockParsed.lockfileVersion);

    const lockedVersions = getLockedVersions(lockParsed);
    const lockedCatalogVersions = getLockedCatalogVersions(lockParsed);

    return {
      lockedVersionsWithPath: lockedVersions,
      lockedVersionsWithCatalog: lockedCatalogVersions,
      lockfileVersion,
    };
  } catch (err) {
    logger.debug({ filePath, err }, 'Warning: Exception parsing pnpm lockfile');
    return { lockedVersions: {} };
  }
}

function getLockedCatalogVersions(
  lockParsed: PnpmLockFile,
): Record<string, Record<string, string>> {
  const lockedVersions: Record<string, Record<string, string>> = {};

  if (is.nonEmptyObject(lockParsed.catalogs)) {
    for (const [catalog, dependencies] of Object.entries(lockParsed.catalogs)) {
      const versions: Record<string, string> = {};

      for (const [dep, versionCarrier] of Object.entries(dependencies)) {
        versions[dep] = versionCarrier.version;
      }

      lockedVersions[catalog] = versions;
    }
  }

  return lockedVersions;
}

function getLockedVersions(
  lockParsed: PnpmLockFile,
): Record<string, Record<string, Record<string, string>>> {
  const lockedVersions: Record<
    string,
    Record<string, Record<string, string>>
  > = {};

  // monorepo
  if (is.nonEmptyObject(lockParsed.importers)) {
    for (const [importer, imports] of Object.entries(lockParsed.importers)) {
      lockedVersions[importer] = getLockedDependencyVersions(imports);
    }
  }
  // normal repo
  else {
    lockedVersions['.'] = getLockedDependencyVersions(lockParsed);
  }

  return lockedVersions;
}

function getLockedDependencyVersions(
  obj: PnpmLockFile | Record<string, PnpmDependencySchema>,
): Record<string, Record<string, string>> {
  const dependencyTypes = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
  ] as const;

  const res: Record<string, Record<string, string>> = {};
  for (const depType of dependencyTypes) {
    res[depType] = {};
    for (const [pkgName, versionCarrier] of Object.entries(
      obj[depType] ?? {},
    )) {
      let version: string;
      if (is.object(versionCarrier)) {
        version = versionCarrier['version'];
      } else {
        version = versionCarrier;
      }

      const pkgVersion = version.split('(')[0].trim();
      res[depType][pkgName] = pkgVersion;
    }
  }

  return res;
}

export function tryParsePnpmWorkspaceYaml(content: string):
  | {
      success: true;
      data: PnpmWorkspaceFile;
    }
  | { success: false; data?: never } {
  try {
    const data = parseSingleYaml(content, {
      customSchema: PnpmWorkspaceFileSchema,
    });
    return { success: true, data };
  } catch {
    return { success: false };
  }
}

type PnpmCatalogs = z.TypeOf<typeof PnpmCatalogsSchema>;

export async function extractPnpmWorkspaceFile(
  catalogs: PnpmCatalogs,
  packageFile: string,
): Promise<PackageFileContent<NpmManagerData> | null> {
  logger.trace(`pnpm.extractPnpmWorkspaceFile(${packageFile})`);

  const pnpmCatalogs = pnpmCatalogsToArray(catalogs);

  const deps = extractPnpmCatalogDeps(pnpmCatalogs);

  let pnpmShrinkwrap;
  const filePath = getSiblingFileName(packageFile, 'pnpm-lock.yaml');

  if (await readLocalFile(filePath, 'utf8')) {
    pnpmShrinkwrap = filePath;
  }

  return {
    deps,
    managerData: {
      pnpmShrinkwrap,
    },
  };
}

/**
 * In order to facilitate matching on specific catalogs, we structure the
 * depType as `pnpm.catalog.default`, `pnpm.catalog.react17`, and so on.
 */
function getCatalogDepType(name: string): string {
  const CATALOG_DEPENDENCY = 'pnpm.catalog';
  return `${CATALOG_DEPENDENCY}.${name}`;
}

function extractPnpmCatalogDeps(
  catalogs: PnpmCatalog[],
): PackageDependency<NpmManagerData>[] {
  const deps: PackageDependency<NpmManagerData>[] = [];

  for (const catalog of catalogs) {
    for (const [key, val] of Object.entries(catalog.dependencies)) {
      const depType = getCatalogDepType(catalog.name);
      const depName = parseDepName(depType, key);
      const dep: PackageDependency<NpmManagerData> = {
        depType,
        depName,
        ...extractDependency(depType, depName, val!),
        prettyDepType: depType,
      };
      deps.push(dep);
    }
  }

  return deps;
}

function pnpmCatalogsToArray({
  catalog: defaultCatalogDeps,
  catalogs: namedCatalogs,
}: PnpmCatalogs): PnpmCatalog[] {
  const result: PnpmCatalog[] = [];

  if (defaultCatalogDeps !== undefined) {
    result.push({ name: 'default', dependencies: defaultCatalogDeps });
  }

  if (!namedCatalogs) {
    return result;
  }

  for (const [name, dependencies] of Object.entries(namedCatalogs)) {
    result.push({
      name,
      dependencies,
    });
  }

  return result;
}
