import { isObject, isString } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { getEnv } from '../../../util/env.ts';
import { findLocalSiblingOrParent } from '../../../util/fs/index.ts';
import { coerceObject } from '../../../util/object.ts';
import { api as versioning } from '../../versioning/cargo/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types.ts';
import { extractLockFileVersions } from './locked-version.ts';
import {
  getMinPublishAgeRules,
  getRegistryMinPublishAges,
} from './minimum-release-age.ts';
import type { CargoConfig } from './schema.ts';
import { CargoManifest } from './schema.ts';
import type {
  CargoManagerData,
  CargoRegistries,
  CargoRegistryUrl,
} from './types.ts';
import {
  DEFAULT_REGISTRY_ID,
  DEFAULT_REGISTRY_URL,
  readCargoConfig,
} from './utils.ts';

function getCargoIndexEnv(registryName: string): string | null {
  const registry = registryName.toUpperCase().replaceAll('-', '_');
  return getEnv()[`CARGO_REGISTRIES_${registry}_INDEX`] ?? null;
}

/** Returns the index of a registry, from the environment or the cargo config. */
function getRegistryUrl(
  registryName: string,
  cargoRegistries: CargoRegistries,
): CargoRegistryUrl | undefined {
  return getCargoIndexEnv(registryName) ?? cargoRegistries[registryName];
}

function extractFromSection(
  dependencies: PackageDependency<CargoManagerData>[] | undefined,
  cargoRegistries: CargoRegistries,
  target?: string,
): PackageDependency<CargoManagerData>[] {
  if (!dependencies) {
    return [];
  }

  const deps: PackageDependency<CargoManagerData>[] = [];

  for (const dep of Object.values(dependencies)) {
    let registryUrls: string[] | undefined;

    if (dep.managerData?.registryName) {
      const registryUrl = getRegistryUrl(
        dep.managerData.registryName,
        cargoRegistries,
      );
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

/** Extracts a map of cargo registries from a CargoConfig */
function extractCargoRegistries(config: CargoConfig): CargoRegistries {
  const result: CargoRegistries = {};
  // check if we're overriding our default registry index
  result[DEFAULT_REGISTRY_ID] = resolveRegistryIndex(
    DEFAULT_REGISTRY_ID,
    config,
  );

  const registryNames = new Set([
    ...Object.keys(coerceObject(config.registries)),
    ...Object.keys(coerceObject(config.source)),
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
  }
  // we don't need an explicit index if we're using the default registry
  if (registryName === DEFAULT_REGISTRY_ID) {
    return DEFAULT_REGISTRY_URL;
  }
  logger.debug(`${registryName} cargo registry is missing index`);
  return null;
}

/**
 * Returns the URL by name of each registry other than crates.io which has a `min-publish-age` in the cargo config, or crates in `deps`, as the crates of that registry have it in `registryUrls`.
 */
function getAlternateRegistryUrls(
  registryMinPublishAges: Record<string, string> | undefined,
  cargoRegistries: CargoRegistries,
  deps: PackageDependency<CargoManagerData>[],
): Record<string, string> {
  const registryNames = new Set([
    ...Object.keys(coerceObject(registryMinPublishAges)),
    ...deps.map((dep) => dep.managerData?.registryName).filter(isString),
  ]);
  registryNames.delete(DEFAULT_REGISTRY_ID);
  const registryUrls: Record<string, string> = {};
  for (const registryName of registryNames) {
    const registryUrl = getRegistryUrl(registryName, cargoRegistries);
    // crates of a registry without a URL are skipped, and those of crates.io have the age of crates.io
    if (isString(registryUrl)) {
      registryUrls[registryName] = registryUrl;
    }
  }
  return registryUrls;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  _config?: ExtractConfig,
): Promise<PackageFileContent<CargoManagerData> | null> {
  logger.trace(`cargo.extractPackageFile(${packageFile})`);

  const cargoConfig = coerceObject(await readCargoConfig());
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
  let targetDeps: PackageDependency<CargoManagerData>[] = [];
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
  let workspaceDeps: PackageDependency<CargoManagerData>[] = [];
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
    if (isString(packageSection.version)) {
      version = packageSection.version;
    } else if (
      isObject(packageSection.version) &&
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
  const res: PackageFileContent<CargoManagerData> = {
    deps,
    packageFileVersion: version,
  };

  const registryMinPublishAges = getRegistryMinPublishAges(cargoConfig);
  // a string if the cargo config replaces crates.io
  const cratesIoUrl = cargoRegistries[DEFAULT_REGISTRY_ID];
  const packageRules = getMinPublishAgeRules(
    cargoConfig,
    getAlternateRegistryUrls(registryMinPublishAges, cargoRegistries, deps),
    isString(cratesIoUrl) ? cratesIoUrl : undefined,
  );
  if (packageRules.length) {
    logger.debug(
      { packageRules },
      `Found min-publish-age in the cargo config for ${packageFile}`,
    );
    res.packageRules = packageRules;
  }
  if (registryMinPublishAges) {
    logger.debug(
      `Found min-publish-age of registries ${Object.keys(registryMinPublishAges).join(', ')} in the cargo config for ${packageFile}`,
    );
    res.managerData = { registryMinPublishAges };
  }

  if (lockFileName) {
    logger.debug(
      `Found lock file ${lockFileName} for packageFile: ${packageFile}`,
    );

    const lockFileVersions = await extractLockFileVersions(lockFileName);
    if (!lockFileVersions) {
      logger.debug(
        `Could not extract lock file versions from ${lockFileName}.`,
      );
      return res;
    }

    res.lockFiles = [lockFileName];
    const { versionsByPackage, hasGitSources } = lockFileVersions;
    // cargo does not check the age of git sources, which lock file maintenance updates
    if (hasGitSources) {
      res.managerData = { ...res.managerData, lockFileHasGitSources: true };
    }

    for (const dep of deps) {
      const packageName = dep.packageName ?? dep.depName!;
      const versions = coerceArray(versionsByPackage.get(packageName));

      let lockedVersion: string | null = null;
      if (dep.currentValue) {
        lockedVersion = versioning.getSatisfyingVersion(
          versions,
          dep.currentValue,
        );
      }

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
