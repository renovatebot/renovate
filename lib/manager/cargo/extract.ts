import { parse } from '@iarna/toml';
import * as datasourceCrate from '../../datasource/crate';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { findLocalSiblingOrParent, readLocalFile } from '../../util/fs';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import type {
  CargoConfig,
  CargoManifest,
  CargoRegistries,
  CargoSection,
} from './types';

function extractFromSection(
  parsedContent: CargoSection,
  section: keyof CargoSection,
  cargoRegistries: CargoRegistries,
  target?: string
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

    if (typeof currentValue !== 'string') {
      const version = currentValue.version;
      const path = currentValue.path;
      const git = currentValue.git;
      const registryName = currentValue.registry;
      if (version) {
        currentValue = version;
        nestedVersion = true;
        if (registryName) {
          const registryUrl = cargoRegistries[registryName];
          if (registryUrl) {
            registryUrls = [registryUrl];
          } else {
            skipReason = SkipReason.UnknownRegistry;
          }
        }
        if (path) {
          skipReason = SkipReason.PathDependency;
        }
        if (git) {
          skipReason = SkipReason.GitDependency;
        }
      } else if (path) {
        currentValue = '';
        skipReason = SkipReason.PathDependency;
      } else if (git) {
        currentValue = '';
        skipReason = SkipReason.GitDependency;
      } else {
        currentValue = '';
        skipReason = SkipReason.InvalidDependencySpecification;
      }
    }
    const dep: PackageDependency = {
      depName,
      depType: section,
      currentValue: currentValue as any,
      managerData: { nestedVersion },
      datasource: datasourceCrate.id,
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
      logger.debug({ registryName }, 'cargo registry is missing index');
    }
  }

  return result;
}

export async function extractPackageFile(
  content: string,
  fileName: string,
  _config?: ExtractConfig
): Promise<PackageFile | null> {
  logger.trace(`cargo.extractPackageFile(${fileName})`);

  const cargoConfig = await readCargoConfig();
  const cargoRegistries = extractCargoRegistries(cargoConfig);

  let cargoManifest: CargoManifest;
  try {
    cargoManifest = parse(content);
  } catch (err) {
    logger.debug({ err }, 'Error parsing Cargo.toml file');
    return null;
  }
  /*
    There are the following sections in Cargo.toml:
    [dependencies]
    [dev-dependencies]
    [build-dependencies]
    [target.*.dependencies]
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
  const deps = [
    ...extractFromSection(cargoManifest, 'dependencies', cargoRegistries),
    ...extractFromSection(cargoManifest, 'dev-dependencies', cargoRegistries),
    ...extractFromSection(cargoManifest, 'build-dependencies', cargoRegistries),
    ...targetDeps,
  ];
  if (!deps.length) {
    return null;
  }
  const lockFileName = await findLocalSiblingOrParent(fileName, 'Cargo.lock');
  const res: PackageFile = { deps };
  // istanbul ignore if
  if (lockFileName) {
    res.lockFiles = [lockFileName];
  }
  return res;
}
