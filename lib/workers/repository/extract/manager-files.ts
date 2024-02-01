import is from '@sindresorhus/is';
import type { ManagerConfig } from '../../../config/types';
import { logger } from '../../../logger';
import {
  extractAllPackageFiles,
  extractPackageFile,
  get,
} from '../../../modules/manager';
import { ManagerKeys } from '../../../modules/manager/api';
import type { AzurePipelinesExtractConfig } from '../../../modules/manager/azure-pipelines';
import type {
  ExtractConfig,
  PackageFile,
} from '../../../modules/manager/types';
import { readLocalFile } from '../../../util/fs';
import type { WorkerExtractConfig } from '../../types';

export async function getManagerPackageFiles(
  workerExtractConfig: WorkerExtractConfig,
  managerConfig: ManagerConfig,
): Promise<PackageFile[] | null> {
  const { enabled, manager, fileList } = workerExtractConfig;
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
      } file(s) for manager ${manager}: ${fileList.join(', ')}`,
    );
  } else {
    return [];
  }
  const config = buildManagerSpecificExtractConfig(
    managerConfig,
    workerExtractConfig,
  );
  // Extract package files synchronously if manager requires it
  if (get(manager, 'extractAllPackageFiles')) {
    const allPackageFiles = await extractAllPackageFiles(
      manager,
      config,
      fileList,
    );
    return allPackageFiles;
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
        config,
      );
      if (res) {
        packageFiles.push({
          ...res,
          packageFile,
        });
      }
    } else {
      logger.debug(`${packageFile} has no content`);
    }
  }
  return packageFiles;
}

function buildManagerSpecificExtractConfig(
  managerConfig: ManagerConfig,
  workerExtractConfig: WorkerExtractConfig,
): ExtractConfig {
  if (managerConfig.manager === ManagerKeys.AZURE_PIPELINES) {
    const azurePipelinesExtractConfig: AzurePipelinesExtractConfig = {
      ...workerExtractConfig,
      repository: managerConfig.repository,
    };
    return azurePipelinesExtractConfig;
  }
  return workerExtractConfig;
}
