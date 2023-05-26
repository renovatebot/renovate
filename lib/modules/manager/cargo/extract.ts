import { parse } from '@iarna/toml';
import { logger } from '../../../logger';
import type { SkipReason } from '../../../types';
import { findLocalSiblingOrParent, readLocalFile } from '../../../util/fs';
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
  CargoSection,
} from './types';

function getCargoIndexEnv(registryName: string): string | null {
  const registry = registryName.toUpperCase().replaceAll('-', '_');
  return process.env[`CARGO_REGISTRIES_${registry}_INDEX`] ?? null;
}

function extractFromSection(
  parsedContent: CargoSection,
  section: keyof CargoSection,
  cargoRegistries: CargoRegistries,
  target?: string,
  depTypeOverride?: string
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
            cargoRegistries[registryName] ?? getCargoIndexEnv(registryName);

          if (registryUrl) {
            registryUrls = [registryUrl];
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
        return parse(payload) as CargoConfig;
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
function extractCargoRegistries(config: CargoConfig | null): CargoRegistries {
  const result: CargoRegistries = {};
  if (!config?.registries) {
    return result;
  }

  const { registries } = config;

  for (const registryName of Object.keys(registries)) {
    const registry = registries[registryName];
    if (registry.index) {
      result[registryName] = registry.index;
    } else {
      logger.debug(`${registryName} cargo registry is missing index`);
    }
  }

  return result;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  _config?: ExtractConfig
): Promise<PackageFileContent | null> {
  logger.trace(`cargo.extractPackageFile(${packageFile})`);

  const cargoConfig = await readCargoConfig();
  const cargoRegistries = extractCargoRegistries(cargoConfig);

  let cargoManifest: CargoManifest;
  try {
    cargoManifest = parse(content);
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
          target
        ),
        ...extractFromSection(
          targetContent,
          'dev-dependencies',
          cargoRegistries,
          target
        ),
        ...extractFromSection(
          targetContent,
          'build-dependencies',
          cargoRegistries,
          target
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
      'workspace.dependencies'
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
    'Cargo.lock'
  );
  const res: PackageFileContent = { deps };
  // istanbul ignore if
  if (lockFileName) {
    res.lockFiles = [lockFileName];
  }
  return res;
}
