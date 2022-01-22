import is from '@sindresorhus/is';
import { logger } from '../../logger';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';
import { TerraformResourceTypes } from './common';
import * as hcl from './hcl';
import { extractLocks, findLockFile, readLockFile } from './lockfile/util';
import { extractTerraformModule } from './modules';
import { extractTerraformProvider } from './providers';
import { extractTerraformRequiredProviders } from './required-providers';
import { analyseTerraformVersion } from './required-version';
import { analyseTerraformResource } from './resources';
import { checkFileContainsDependency } from './util';

const contentCheckList = [
  'module "',
  'provider "',
  'required_providers ',
  ' "helm_release" ',
  ' "docker_image" ',
  'required_version',
];

export async function extractPackageFile(
  content: string,
  fileName: string,
  config: ExtractConfig
): Promise<PackageFile | null> {
  logger.trace({ content }, 'terraform.extractPackageFile()');
  if (!checkFileContainsDependency(content, contentCheckList)) {
    logger.trace(
      { fileName },
      'preflight content check has not found any relevant content'
    );
    return null;
  }

  const locks = [];
  const lockFilePath = findLockFile(fileName);
  if (lockFilePath) {
    const lockFileContent = await readLockFile(lockFilePath);
    if (lockFileContent) {
      const extractedLocks = extractLocks(lockFileContent);
      if (is.nonEmptyArray(extractedLocks)) {
        locks.push(...extractedLocks);
      }
    }
  }

  const dependencies: PackageDependency[] = [];
  const hclMap = hcl.parseHCL(content);

  const terraformBlocks = hclMap.terraform;
  if (terraformBlocks) {
    terraformBlocks.flatMap((terraformBlock) => {
      const requiredProviders = terraformBlock['required_providers'];
      dependencies.push(
        ...extractTerraformRequiredProviders(requiredProviders, locks)
      );

      const required_version = terraformBlock.required_version;
      if (required_version) {
        dependencies.push(
          analyseTerraformVersion({
            currentValue: required_version,
          })
        );
      }
    });
  }

  const providers = hclMap.provider;
  if (providers) {
    dependencies.push(...extractTerraformProvider(providers, locks));
  }

  const modules = hclMap.module;
  if (modules) {
    dependencies.push(...extractTerraformModule(modules));
  }

  const helmReleases = hclMap.resource?.helm_release;
  if (helmReleases) {
    const deps = Object.keys(helmReleases)
      .flatMap((helmRelease) => {
        return helmReleases[helmRelease].map((value) => {
          return {
            currentValue: value.version,
            managerData: {
              resourceType: TerraformResourceTypes.helm_release,
              chart: value.chart,
              repository: value.repository,
            },
          };
        });
      })
      .map(analyseTerraformResource);
    dependencies.push(...deps);
  }

  const dockerImages = hclMap.resource?.docker_image;
  if (dockerImages) {
    const deps = Object.keys(dockerImages)
      .flatMap((dockerImage) => {
        return dockerImages[dockerImage].map((value) => {
          return {
            currentValue: value.version,
            managerData: {
              resourceType: TerraformResourceTypes.docker_image,
              name: value.name,
            },
          };
        });
      })
      .map(analyseTerraformResource);
    dependencies.push(...deps);
  }

  const dockerContainers = hclMap.resource?.docker_container;
  if (dockerContainers) {
    const deps = Object.keys(dockerContainers)
      .flatMap((dockerContainer) => {
        return dockerContainers[dockerContainer].map((value) => {
          return {
            managerData: {
              resourceType: TerraformResourceTypes.docker_container,
              image: value.image,
            },
          };
        });
      })
      .map(analyseTerraformResource);
    dependencies.push(...deps);
  }

  const dockerServices = hclMap.resource?.docker_service;
  if (dockerServices) {
    const deps = Object.keys(dockerServices)
      .flatMap((dockerService) => {
        return dockerServices[dockerService].map((value) => {
          return {
            managerData: {
              resourceType: TerraformResourceTypes.docker_service,
              image: value?.task_spec?.[0]?.container_spec?.[0]?.image,
            },
          };
        });
      })
      .map(analyseTerraformResource);
    dependencies.push(...deps);
  }

  dependencies.forEach((value) => delete value.managerData);

  if (dependencies.some((dep) => dep.skipReason !== 'local')) {
    return { deps: dependencies };
  }
  return null;
}
