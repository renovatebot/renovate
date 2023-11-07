import { logger } from '../../../logger';
import type { SkipReason } from '../../../types';
import { findLocalSiblingOrParent, readLocalFile } from '../../../util/fs';
import { parse as parseToml } from '../../../util/toml';
import { CrateDatasource } from '../../datasource/crate';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFileContent,
} from '../types';
import type {
  CargoConfig,
  CargoManifest,
  CargoRegistries,
  CargoRegistryUrl,
  CargoSection,
} from './types';
import { DEFAULT_REGISTRY_URL } from './utils';

const DEFAULT_REGISTRY_ID = 'crates-io';

function getCargoIndexEnv(registryName: string): string | null {
  const registry = registryName.toUpperCase().replaceAll('-', '_');
  return process.env[`CARGO_REGISTRIES_${registry}_INDEX`] ?? null;
}

function extractFromSection(
  parsedContent: CargoSection,
  section: keyof CargoSection,
  cargoRegistries: CargoRegistries,
  target?: string,
  depTypeOverride?: string,
): PackageDependency[] {
  const deps: PackageDependency[] = [];
  const sectionContent = parsedContent[section];
  if (!sectionContent) {
    return [];
  }
  Object.keys(sectionContent).forEach((depName) => {
    let skipReason: SkipReason | undefined;
    let currentValue = sectionContent[depName];
    let nestedVersion = false;
    let registryUrls: string[] | undefined;
    let packageName: string | undefined;

    if (typeof currentValue !== 'string') {
      const version = currentValue.version;
      const path = currentValue.path;
      const git = currentValue.git;
      const registryName = currentValue.registry;
      const workspace = currentValue.workspace;

      packageName = currentValue.package;

      if (version) {
        currentValue = version;
        nestedVersion = true;
        if (registryName) {
          const registryUrl =
            getCargoIndexEnv(registryName) ?? cargoRegistries[registryName];

          if (registryUrl) {
            if (registryUrl !== DEFAULT_REGISTRY_URL) {
              registryUrls = [registryUrl];
            }
          } else {
            skipReason = 'unknown-registry';
          }
        }
        if (path) {
          skipReason = 'path-dependency';
        }
        if (git) {
          skipReason = 'git-dependency';
        }
      } else if (path) {
        currentValue = '';
        skipReason = 'path-dependency';
      } else if (git) {
        currentValue = '';
        skipReason = 'git-dependency';
      } else if (workspace) {
        currentValue = '';
        skipReason = 'inherited-dependency';
      } else {
        currentValue = '';
        skipReason = 'invalid-dependency-specification';
      }
    }
    const dep: PackageDependency = {
      depName,
      depType: section,
      currentValue: currentValue as any,
      managerData: { nestedVersion },
      datasource: CrateDatasource.id,
    };
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
        skipReason = 'unknown-registry';
      }
    }

    if (skipReason) {
      dep.skipReason = skipReason;
    }
    if (target) {
      dep.target = target;
    }
    if (packageName) {
      dep.packageName = packageName;
    }
    if (depTypeOverride) {
      dep.depType = depTypeOverride;
    }
    deps.push(dep);
  });
  return deps;
}

/** Reads `.cargo/config.toml`, or, if not found, `.cargo/config` */
async function readCargoConfig(): Promise<CargoConfig | null> {
  for (const configName of ['config.toml', 'config']) {
    const path = `.cargo/${configName}`;
    const payload = await readLocalFile(path, 'utf8');
    if (payload) {
      try {
        return parseToml(payload) as CargoConfig;
      } catch (err) {
        logger.debug({ err }, `Error parsing ${path}`);
      }
      break;
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
  originalNames: Set<string> = new Set(),
): CargoRegistryUrl {
  // if we have a source replacement, follow that.
  // https://doc.rust-lang.org/cargo/reference/source-replacement.html
  const replacementName = config.source?.[registryName]?.['replace-with'];
  if (replacementName) {
    logger.debug(
      `Replacing index of cargo registry ${registryName} with ${replacementName}`,
    );
    if (originalNames.has(replacementName)) {
      logger.warn(`${registryName} cargo registry resolves to itself`);
      return null;
    }
    return resolveRegistryIndex(
      replacementName,
      config,
      originalNames.add(replacementName),
    );
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
): Promise<PackageFileContent | null> {
  logger.trace(`cargo.extractPackageFile(${packageFile})`);

  const cargoConfig = (await readCargoConfig()) ?? {};
  const cargoRegistries = extractCargoRegistries(cargoConfig);

  let cargoManifest: CargoManifest;
  try {
    cargoManifest = parseToml(content) as CargoManifest;
  } catch (err) {
    logger.debug({ err, packageFile }, 'Error parsing Cargo.toml file');
    return null;
  }
  /*
    There are the following sections in Cargo.toml:
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
          targetContent,
          'dependencies',
          cargoRegistries,
          target,
        ),
        ...extractFromSection(
          targetContent,
          'dev-dependencies',
          cargoRegistries,
          target,
        ),
        ...extractFromSection(
          targetContent,
          'build-dependencies',
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
      workspaceSection,
      'dependencies',
      cargoRegistries,
      undefined,
      'workspace.dependencies',
    );
  }

  const deps = [
    ...extractFromSection(cargoManifest, 'dependencies', cargoRegistries),
    ...extractFromSection(cargoManifest, 'dev-dependencies', cargoRegistries),
    ...extractFromSection(cargoManifest, 'build-dependencies', cargoRegistries),
    ...targetDeps,
    ...workspaceDeps,
  ];
  if (!deps.length) {
    return null;
  }
  const lockFileName = await findLocalSiblingOrParent(
    packageFile,
    'Cargo.lock',
  );
  const res: PackageFileContent = { deps };
  // istanbul ignore if
  if (lockFileName) {
    res.lockFiles = [lockFileName];
  }
  return res;
}
