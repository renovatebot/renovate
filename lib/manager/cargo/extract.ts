import { parse } from '@iarna/toml';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import * as datasourceCrate from '../../datasource/crate';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { ExtractConfig, PackageDependency, PackageFile } from '../common';
import {
  CargoConfig,
  CargoConfig as CargoManifest,
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
    let skipReason: SkipReason;
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
          let registryUrl = cargoRegistries[registryName];
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
      registryUrls,
    };
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

export function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): PackageFile | null {
  logger.trace(`cargo.extractPackageFile(${fileName})`);

  let cargoConfig: CargoConfig | undefined;
  if (config.localDir) {
    let configPath = join(config.localDir, '.cargo', 'config.toml');
    if (!existsSync(configPath)) {
      configPath = join(config.localDir, '.cargo', 'config');
    }

    if (existsSync(configPath)) {
      try {
        // TODO: fix type
        cargoConfig = parse(
          readFileSync(configPath, { encoding: 'utf-8' })
        ) as any;
      } catch (err) {
        logger.debug({ err }, 'Error parsing .cargo/config.toml file');
      }
    } else {
      logger.debug('Neither .cargo/config nor .cargo/config.toml found');
    }
  }

  let cargoRegistries: CargoRegistries = {};
  if (cargoConfig) {
    if (cargoConfig.registries) {
      for (const registryName of Object.keys(cargoConfig.registries)) {
        let registry = cargoConfig.registries[registryName];
        if (registry.index) {
          cargoRegistries[registryName] = registry.index;
        } else {
          logger.debug({ registryName }, 'cargo registry is missing index');
        }
      }
    }
  }

  let parsedContent: CargoManifest;
  try {
    // TODO: fix type
    parsedContent = parse(content) as any;
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
  const targetSection = parsedContent.target;
  // An array of all dependencies in the target section
  let targetDeps: PackageDependency[] = [];
  if (targetSection) {
    const targets = Object.keys(targetSection);
    targets.forEach((target) => {
      const targetContent = parsedContent.target[target];
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
    ...extractFromSection(parsedContent, 'dependencies', cargoRegistries),
    ...extractFromSection(parsedContent, 'dev-dependencies', cargoRegistries),
    ...extractFromSection(parsedContent, 'build-dependencies', cargoRegistries),
    ...targetDeps,
  ];
  if (!deps.length) {
    return null;
  }
  let res = { deps };
  console.log(`extracted package file: ${JSON.stringify(res, null, 2)}`);
  return res;
}
