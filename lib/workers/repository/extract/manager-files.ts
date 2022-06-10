import is from '@sindresorhus/is';
import type {
  CustomManager,
  ManagerConfig,
  MatchStringsStrategy,
} from '../../../config/types';
import { logger } from '../../../logger';
import {
  extractAllPackageFiles,
  extractPackageFile,
  get,
} from '../../../modules/manager';
import type {
  CustomExtractConfig,
  ExtractConfig,
  PackageFile,
} from '../../../modules/manager/types';
import { readLocalFile } from '../../../util/fs';

export function getExtractConfig(config: ManagerConfig): ExtractConfig {
  const result: ExtractConfig = {
    npmrc: config.npmrc,
    aliases: config.aliases,
    skipInstalls: config.skipInstalls,
    npmrcMerge: config.npmrcMerge,
  };
  return result;
}

export function getCustomExtractConfig(
  config: ManagerConfig & CustomManager
): CustomExtractConfig {
  const result: CustomExtractConfig = {
    matchStrings: config.matchStrings,
    autoReplaceStringTemplate: config.autoReplaceStringTemplate,
    matchStringsStrategy: config.matchStringsStrategy as MatchStringsStrategy,
    depNameTemplate: config.depNameTemplate,
    packageNameTemplate: config.packageNameTemplate,
    datasourceTemplate: config.datasourceTemplate,
    versioningTemplate: config.versioningTemplate,
    depTypeTemplate: config.depTypeTemplate,
    currentValueTemplate: config.currentValueTemplate,
    currentDigestTemplate: config.currentDigestTemplate,
    extractVersionTemplate: config.extractVersionTemplate,
    registryUrlTemplate: config.registryUrlTemplate,
  };

  return result;
}

export async function getManagerPackageFiles(
  config: ManagerConfig | (ManagerConfig & CustomManager)
): Promise<PackageFile[]> {
  const { enabled, manager, fileList } = config;
  const extractConfig =
    manager === 'regex'
      ? getCustomExtractConfig(config as ManagerConfig & CustomManager)
      : getExtractConfig(config);
  logger.trace(`getPackageFiles(${manager})`);
  if (!enabled) {
    logger.debug(`${manager} is disabled`);
    return [];
  }
  // istanbul ignore else
  if (is.nonEmptyArray(fileList)) {
    logger.debug(
      `Matched ${
        fileList.length
      } file(s) for manager ${manager}: ${fileList.join(', ')}`
    );
  } else {
    return [];
  }
  // Extract package files synchronously if manager requires it
  if (get(manager, 'extractAllPackageFiles')) {
    const allPackageFiles = await extractAllPackageFiles(
      manager,
      extractConfig,
      fileList
    );
    if (allPackageFiles) {
      for (const packageFile of allPackageFiles) {
        for (let index = 0; index < packageFile.deps.length; index += 1) {
          packageFile.deps[index].depIndex = index;
        }
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    return allPackageFiles!;
  }
  const packageFiles: PackageFile[] = [];
  for (const packageFile of fileList) {
    const content = await readLocalFile(packageFile, 'utf8');
    // istanbul ignore else
    if (content) {
      const res = await extractPackageFile(
        manager,
        content,
        packageFile,
        extractConfig
      );
      if (res) {
        for (let index = 0; index < res.deps.length; index += 1) {
          res.deps[index].depIndex = index;
        }
        packageFiles.push({
          packageFile,
          ...res,
        });
      }
    } else {
      logger.debug({ packageFile }, 'packageFile has no content');
    }
  }
  return packageFiles;
}
