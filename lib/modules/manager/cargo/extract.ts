import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { getEnv } from '../../../util/env';
import { findLocalSiblingOrParent, readLocalFile } from '../../../util/fs';
import { api as versioning } from '../../versioning/cargo';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import { extractLockFileVersions } from './locked-version';
import { CargoConfig, CargoManifest } from './schema';
import type {
  CargoManagerData,
  CargoRegistries,
  CargoRegistryUrl,
} from './types';
import { DEFAULT_REGISTRY_URL } from './utils';

const DEFAULT_REGISTRY_ID = 'crates-io';

function getCargoIndexEnv(registryName: string): string | null {
  const registry = registryName.toUpperCase().replaceAll('-', '_');
  return getEnv()[`CARGO_REGISTRIES_${registry}_INDEX`] ?? null;
}

function extractFromSection(
  dependencies: PackageDependency<CargoManagerData>[] | undefined,
  cargoRegistries: CargoRegistries,
  target?: string,
): PackageDependency[] {
  if (!dependencies) {
    return [];
  }

  const deps: PackageDependency<CargoManagerData>[] = [];

  for (const dep of Object.values(dependencies)) {
    let registryUrls: string[] | undefined;

    if (dep.managerData?.registryName) {
      const registryUrl =
        getCargoIndexEnv(dep.managerData.registryName) ??
        cargoRegistries[dep.managerData?.registryName];
      if (registryUrl) {
        if (registryUrl !== DEFAULT_REGISTRY_URL) {
          registryUrls = [registryUrl];
        }
      } else {
        dep.skipReason = 'unknown-registry';
      }
    }

    if (registryUrls) {
      dep.registryUrls = registryUrls;
    } else {
      // if we don't have an explicit registry URL check if the default registry has a non-standard url
      if (cargoRegistries[DEFAULT_REGISTRY_ID]) {
        if (cargoRegistries[DEFAULT_REGISTRY_ID] !== DEFAULT_REGISTRY_URL) {
          dep.registryUrls = [cargoRegistries[DEFAULT_REGISTRY_ID]];
        }
      } else {
        // we always expect to have DEFAULT_REGISTRY_ID set, if it's not it means the config defines an alternative
        // registry that we couldn't resolve.
        dep.skipReason = 'unknown-registry';
      }
    }

    if (target) {
      dep.target = target;
    }
    deps.push(dep);
  }

  return deps;
}

/** Reads `.cargo/config.toml`, or, if not found, `.cargo/config` */
async function readCargoConfig(): Promise<CargoConfig | null> {
  for (const configName of ['config.toml', 'config']) {
    const path = `.cargo/${configName}`;
    const payload = await readLocalFile(path, 'utf8');
    if (payload) {
      const parsedCargoConfig = CargoConfig.safeParse(payload);
      if (parsedCargoConfig.success) {
        return parsedCargoConfig.data;
      } else {
        logger.debug(
          { err: parsedCargoConfig.error, path },
          `Error parsing cargo config`,
        );
      }
    }
  }

  logger.debug('Neither .cargo/config nor .cargo/config.toml found');
  return null;
}

/** Extracts a map of cargo registries from a CargoConfig */
function extractCargoRegistries(config: CargoConfig): CargoRegistries {
  const result: CargoRegistries = {};
  // check if we're overriding our default registry index
  result[DEFAULT_REGISTRY_ID] = resolveRegistryIndex(
    DEFAULT_REGISTRY_ID,
    config,
  );

  const registryNames = new Set([
    ...Object.keys(config.registries ?? {}),
    ...Object.keys(config.source ?? {}),
  ]);
  for (const registryName of registryNames) {
    result[registryName] = resolveRegistryIndex(registryName, config);
  }

  return result;
}

function resolveRegistryIndex(
  registryName: string,
  config: CargoConfig,
  originalNames = new Set<string>(),
): CargoRegistryUrl {
  // if we have a source replacement, follow that.
  // https://doc.rust-lang.org/cargo/reference/source-replacement.html
  const replacementName = config.source?.[registryName]?.['replace-with'];
  if (replacementName) {
    logger.debug(
      `Replacing index of cargo registry ${registryName} with ${replacementName}`,
    );
    if (originalNames.has(replacementName)) {
      logger.warn({ registryName }, 'cargo registry resolves to itself');
      return null;
    }
    return resolveRegistryIndex(
      replacementName,
      config,
      originalNames.add(replacementName),
    );
  }

  const sourceRegistry = config.source?.[registryName]?.registry;
  if (sourceRegistry) {
    logger.debug(
      `Replacing cargo source registry with ${sourceRegistry} for ${registryName}`,
    );
    return sourceRegistry;
  }

  const registryIndex = config.registries?.[registryName]?.index;
  if (registryIndex) {
    return registryIndex;
  } else {
    // we don't need an explicit index if we're using the default registry
    if (registryName === DEFAULT_REGISTRY_ID) {
      return DEFAULT_REGISTRY_URL;
    } else {
      logger.debug(`${registryName} cargo registry is missing index`);
      return null;
    }
  }
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  _config?: ExtractConfig,
): Promise<PackageFileContent<CargoManagerData> | null> {
  logger.trace(`cargo.extractPackageFile(${packageFile})`);

  const cargoConfig = (await readCargoConfig()) ?? {};
  const cargoRegistries = extractCargoRegistries(cargoConfig);

  const parsedCargoManifest = CargoManifest.safeParse(content);
  if (!parsedCargoManifest.success) {
    logger.debug(
      { err: parsedCargoManifest.error, packageFile },
      'Error parsing Cargo.toml file',
    );
    return null;
  }

  const cargoManifest = parsedCargoManifest.data;

  /*
    There are the following sections in Cargo.toml:
    [package]
    [dependencies]
    [dev-dependencies]
    [build-dependencies]
    [target.*.dependencies]
    [workspace.dependencies]
  */
  const targetSection = cargoManifest.target;
  // An array of all dependencies in the target section
  let targetDeps: PackageDependency[] = [];
  if (targetSection) {
    const targets = Object.keys(targetSection);
    targets.forEach((target) => {
      const targetContent = targetSection[target];
      // Dependencies for `${target}`
      const deps = [
        ...extractFromSection(
          targetContent.dependencies,
          cargoRegistries,
          target,
        ),
        ...extractFromSection(
          targetContent['dev-dependencies'],
          cargoRegistries,
          target,
        ),
        ...extractFromSection(
          targetContent['build-dependencies'],
          cargoRegistries,
          target,
        ),
      ];
      targetDeps = targetDeps.concat(deps);
    });
  }

  const workspaceSection = cargoManifest.workspace;
  let workspaceDeps: PackageDependency[] = [];
  if (workspaceSection) {
    workspaceDeps = extractFromSection(
      workspaceSection.dependencies,
      cargoRegistries,
      undefined,
    );
  }

  const deps = [
    ...extractFromSection(cargoManifest.dependencies, cargoRegistries),
    ...extractFromSection(cargoManifest['dev-dependencies'], cargoRegistries),
    ...extractFromSection(cargoManifest['build-dependencies'], cargoRegistries),
    ...targetDeps,
    ...workspaceDeps,
  ];
  if (!deps.length) {
    return null;
  }

  const packageSection = cargoManifest.package;
  let version: string | undefined = undefined;
  if (packageSection) {
    if (is.string(packageSection.version)) {
      version = packageSection.version;
    } else if (
      is.object(packageSection.version) &&
      cargoManifest.workspace?.package?.version
    ) {
      // TODO: Support reading from parent workspace manifest?
      version = cargoManifest.workspace.package.version;
    }
  }

  const lockFileName = await findLocalSiblingOrParent(
    packageFile,
    'Cargo.lock',
  );
  const res: PackageFileContent = { deps, packageFileVersion: version };
  if (lockFileName) {
    logger.debug(
      `Found lock file ${lockFileName} for packageFile: ${packageFile}`,
    );

    const versionsByPackage = await extractLockFileVersions(lockFileName);
    if (!versionsByPackage) {
      logger.debug(
        `Could not extract lock file versions from ${lockFileName}.`,
      );
      return res;
    }

    res.lockFiles = [lockFileName];

    for (const dep of deps) {
      const packageName = dep.packageName ?? dep.depName!;
      const versions = coerceArray(versionsByPackage.get(packageName));
      const lockedVersion = versioning.getSatisfyingVersion(
        versions,
        dep.currentValue!,
      );
      if (lockedVersion) {
        dep.lockedVersion = lockedVersion;
      } else {
        logger.debug(
          `No locked version found for package ${dep.depName} in the range of ${dep.currentValue}.`,
        );
      }
    }
  }

  return res;
}
