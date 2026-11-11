import { parsePkgAndParentSelector } from '@pnpm/parse-overrides';
import {
  isNonEmptyObject,
  isNullOrUndefined,
  isNumber,
  isNumericString,
  isObject,
  isPlainObject,
  isString,
} from '@sindresorhus/is';
import { findPackages } from 'find-packages';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global.ts';
import { logger } from '../../../../logger/index.ts';
import type { MaybePromise } from '../../../../types/index.ts';
import {
  findLocalSiblingOrParent,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../../util/fs/index.ts';
import { coerceObject } from '../../../../util/object.ts';
import { parseSingleYaml, parseYaml } from '../../../../util/yaml.ts';
import { NpmDatasource } from '../../../datasource/npm/index.ts';
import type {
  PackageDependency,
  PackageFile,
  PackageFileContent,
  ToolConstraintsConfig,
} from '../../types.ts';
import { resolveToolConstraint } from '../../util.ts';
import { pnpmWorkspaceOverrides } from '../dep-types.ts';
import type { PnpmDependency, PnpmLockFile } from '../post-update/types.ts';
import type { PnpmCatalogs, PnpmWorkspaceFile } from '../schema.ts';
import type { NpmManagerData } from '../types.ts';
import { extractCatalogDeps } from './common/catalogs.ts';
import { extractDependency } from './common/dependency.ts';
import type { Catalog, LockFile } from './types.ts';

function isPnpmLockfile(obj: any): obj is PnpmLockFile {
  return isPlainObject(obj) && 'lockfileVersion' in obj;
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
      !contents.packages.every((item) => isString(item))
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
    const pnpmLockFile = managerData?.pnpmLockFile;

    // check if pnpmLockFile-file has already been provided
    if (pnpmLockFile) {
      logger.trace(
        { packageFile, pnpmLockFile },
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
      // TODO: types (#22198)
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
      p.managerData.pnpmLockFile = lockFilePath;
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

    // pnpm writes a multi-document YAML lockfile when `pnpm-workspace.yaml`
    // declares `configDependencies`; the env document (config-deps + integrity
    // metadata) is unconditionally prepended before the main lockfile, so the
    // main lockfile is always the last document.
    // https://pnpm.io/config-dependencies.
    const parsedDocs = parseYaml(pnpmLockRaw);
    const lockParsed = parsedDocs.at(-1);
    if (!isPnpmLockfile(lockParsed)) {
      throw new Error('Invalid or empty lockfile');
    }
    logger.trace({ lockParsed }, 'pnpm lockfile parsed');

    // field lockfileVersion is type string in lockfileVersion = 6 and type number in < 6
    const lockfileVersion: number = isNumber(lockParsed.lockfileVersion)
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

  if (isNonEmptyObject(lockParsed.catalogs)) {
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
  if (isNonEmptyObject(lockParsed.importers)) {
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
  obj: PnpmLockFile | Record<string, PnpmDependency>,
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
      coerceObject(obj[depType]),
    )) {
      let version: string;
      if (isObject(versionCarrier)) {
        version = versionCarrier.version;
      } else {
        version = versionCarrier;
      }

      const pkgVersion = version.split('(')[0].trim();
      res[depType][pkgName] = pkgVersion;
    }
  }

  return res;
}

export async function extractPnpmWorkspaceFile(
  workspaceFile: PnpmWorkspaceFile,
  packageFile: string,
): Promise<PackageFileContent<NpmManagerData> | null> {
  logger.trace(`pnpm.extractPnpmWorkspaceFile(${packageFile})`);

  const pnpmCatalogs = pnpmCatalogsToArray(workspaceFile);

  const deps = extractCatalogDeps(pnpmCatalogs);

  if (workspaceFile.overrides) {
    for (const [overridesKey, overridesVal] of Object.entries(
      workspaceFile.overrides,
    )) {
      // flat syntax: `parent>parent>child`
      const packageName =
        parsePkgAndParentSelector(overridesKey).targetPkg.name;
      const depType = pnpmWorkspaceOverrides;
      deps.push({
        depName: overridesKey,
        packageName,
        depType,
        ...extractDependency(depType, packageName, overridesVal),
      });
    }
  }

  const { registry, registries } = workspaceFile;
  applyPnpmWorkspaceRegistries(deps, registries, registry);

  let pnpmLockFile;
  const filePath = getSiblingFileName(packageFile, 'pnpm-lock.yaml');

  if (await readLocalFile(filePath, 'utf8')) {
    pnpmLockFile = filePath;
  }

  return {
    deps,
    managerData: {
      pnpmLockFile,
    },
  };
}

function pnpmCatalogsToArray({
  catalog: defaultCatalogDeps,
  catalogs: namedCatalogs,
}: PnpmCatalogs): Catalog[] {
  const result: Catalog[] = [];

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

export function applyPnpmWorkspaceRegistries(
  deps: PackageDependency[],
  registries: Record<string, string> | undefined,
  registry: string | undefined,
): void {
  if (!(registry ?? registries)) {
    return;
  }
  for (const dep of deps) {
    const lookupName = dep.packageName ?? dep.depName;
    if (lookupName && dep.datasource === NpmDatasource.id) {
      const registryUrl = resolveRegistryUrl(lookupName, registries, registry);
      if (registryUrl) {
        dep.registryUrls = [registryUrl];
      }
    }
  }
}

export function resolveRegistryUrl(
  packageName: string,
  registries: Record<string, string> | undefined,
  defaultRegistry: string | undefined,
): string | null {
  if (registries) {
    for (const scope in registries) {
      // `default` is the fallback registry, not a scope
      if (scope === 'default') {
        continue;
      }
      // pnpm scope keys keep the leading `@`, e.g. `@my-org`
      if (packageName.startsWith(`${scope}/`)) {
        return registries[scope];
      }
    }
    if (registries.default) {
      return registries.default;
    }
  }
  return defaultRegistry ?? null;
}

export async function getConstraintFromLockFile(
  lockFileName: string,
): Promise<string | null> {
  let constraint: string | null = null;
  try {
    const lockfileContent = await readLocalFile(lockFileName, 'utf8');
    if (!lockfileContent) {
      logger.trace(`Empty pnpm lock file: ${lockFileName}`);
      return null;
    }
    // TODO: use schema (#9610)
    const pnpmLock = parseSingleYaml<PnpmLockFile>(lockfileContent);
    if (
      !isNumber(pnpmLock?.lockfileVersion) &&
      !isNumericString(pnpmLock?.lockfileVersion)
    ) {
      logger.trace(`Invalid pnpm lockfile version: ${lockFileName}`);
      return null;
    }
    // find matching lockfileVersion and use its constraints
    // if no match found use lockfileVersion 5
    // lockfileVersion 5 is the minimum version required to generate the pnpm-lock.yaml file
    const { lowerConstraint, upperConstraint } = lockToPnpmVersionMapping.find(
      (m) => m.lockfileVersion === pnpmLock.lockfileVersion,
    ) ?? {
      lockfileVersion: 5.0,
      lowerConstraint: '>=3',
      upperConstraint: '<3.5.0',
    };
    constraint = lowerConstraint;
    if (upperConstraint) {
      constraint += ` ${upperConstraint}`;
    }
  } catch (err) {
    logger.warn({ err }, 'Error getting pnpm constraints from lock file');
  }
  return constraint;
}

/**
 * Resolves the pnpm constraint of `pnpmLockFile` from the tool constraints config, the pnpm version of the root `package.json` which `getPackageJsonConstraint` returns, or the `lockfileVersion` of the lock file.
 */
export async function resolvePnpmConstraint(
  config: ToolConstraintsConfig,
  pnpmLockFile: string,
  getPackageJsonConstraint: () => MaybePromise<string | null | undefined>,
): Promise<string | undefined> {
  return await resolveToolConstraint(config, 'pnpm', async () => {
    let pnpmVersion = await getPackageJsonConstraint();
    if (isNullOrUndefined(pnpmVersion)) {
      pnpmVersion = await getConstraintFromLockFile(pnpmLockFile);
    }
    return pnpmVersion;
  });
}

/**
 * pnpm lockfiles have corresponding version numbers called "lockfileVersion"
 * each lockfileVersion can only be generated by a certain pnpm version range
 * eg. lockfileVersion: 5.4 can only be generated by pnpm version >=7 && <8
 * official list can be found here : https://github.com/pnpm/spec/tree/master/lockfile
 * we use the mapping present below to find the compatible pnpm version range for a given lockfileVersion
 *
 * the various terms used in the mapping are explained below:
 * lowerConstraint : lowest pnpm version that can generate the lockfileVersion
 * upperConstraint : highest pnpm version that can generate the lockfileVersion
 * lowerBound      : highest pnpm version that is less than the lowerConstraint
 * upperBound      : lowest pnpm version that is greater than the upperConstraint
 *
 * To handle future lockfileVersions, we need to:
 * 1. add a upperBound and upperConstraint to the current latest lockfileVersion
 * 2. add an object for the new lockfileVersion with lowerBound and lowerConstraint
 *
 * lockfileVersion from v6 on are strings
 */
const lockToPnpmVersionMapping: LockToPnpmVersionMapping[] = [
  { lockfileVersion: '9.0', lowerConstraint: '>=9' },
  {
    lockfileVersion: '6.0',
    lowerConstraint: '>=7.24.2',
    upperConstraint: '<9',
  },
  {
    lockfileVersion: 5.4,
    lowerConstraint: '>=7',
    upperConstraint: '<8',
  },
  {
    lockfileVersion: 5.3,
    lowerConstraint: '>=6',
    upperConstraint: '<7',
  },
  {
    lockfileVersion: 5.2,
    lowerConstraint: '>=5.10.0',
    upperConstraint: '<6',
  },
  {
    lockfileVersion: 5.1,
    lowerConstraint: '>=3.5.0',
    upperConstraint: '<5.9.3',
  },
];

interface LockToPnpmVersionMapping {
  lockfileVersion: string | number;
  lowerConstraint: string;
  upperConstraint?: string;
}
