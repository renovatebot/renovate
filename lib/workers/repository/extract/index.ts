import { isNonEmptyArray } from '@sindresorhus/is';
import { getManagerConfig, mergeChildConfig } from '../../../config/index.ts';
import type { ManagerConfig, RenovateConfig } from '../../../config/types.ts';
import { instrument } from '../../../instrumentation/index.ts';
import { logger } from '../../../logger/index.ts';
import { isCustomManager } from '../../../modules/manager/custom/index.ts';
import {
  getEnabledManagersList,
  hashMap,
} from '../../../modules/manager/index.ts';
import { scm } from '../../../modules/platform/scm.ts';
import type { ExtractResult, WorkerExtractConfig } from '../../types.ts';
import { getMatchingFiles } from './file-match.ts';
import { getManagerPackageFiles } from './manager-files.ts';
import { processSupersedesManagers } from './supersedes.ts';

export async function extractAllDependencies(
  config: RenovateConfig,
): Promise<ExtractResult> {
  const managerList = getEnabledManagersList(config.enabledManagers);
  const extractList: WorkerExtractConfig[] = [];
  const fileList = await scm.getFileList();

  const tryConfig = (managerConfig: ManagerConfig): void => {
    const matchingFileList = getMatchingFiles(managerConfig, fileList);
    if (matchingFileList.length) {
      extractList.push({ ...managerConfig, fileList: matchingFileList });
    }
  };

  instrument('filter packageFiles for managers', () => {
    for (const manager of managerList) {
      const managerConfig = getManagerConfig(config, manager);
      managerConfig.manager = manager;
      if (isCustomManager(manager)) {
        const filteredCustomManagers = (config.customManagers ?? []).filter(
          (mgr) => mgr.customType === manager,
        );
        for (const customManager of filteredCustomManagers) {
          tryConfig(mergeChildConfig(managerConfig, customManager));
        }
      } else {
        tryConfig(managerConfig);
      }
    }
  });

  const extractResult: ExtractResult = {
    packageFiles: {},
    extractionFingerprints: {},
  };

  // Store the fingerprint of all managers which match any file (even if they do not find any dependencies)
  // The cached result needs to be invalidated if the fingerprint of any matching manager changes
  for (const { manager } of extractList) {
    extractResult.extractionFingerprints[manager] = hashMap.get(manager);
  }

  const extractDurations: Record<string, number> = {};
  const extractResults = await Promise.all(
    extractList.map(async (managerConfig) => {
      const start = Date.now();
      const packageFiles = await instrument(
        managerConfig.manager,
        async () => await getManagerPackageFiles(managerConfig),
      );
      const durationMs = Math.round(Date.now() - start);
      extractDurations[managerConfig.manager] = durationMs;
      return { manager: managerConfig.manager, packageFiles };
    }),
  );

  // De-duplicate results using supersedesManagers
  processSupersedesManagers(extractResults);

  logger.debug(
    { managers: extractDurations },
    'manager extract durations (ms)',
  );
  let fileCount = 0;
  for (const { manager, packageFiles } of extractResults) {
    if (packageFiles?.length) {
      fileCount += packageFiles.length;
      logger.debug(`Found ${manager} package files`);
      extractResult.packageFiles[manager] = (
        extractResult.packageFiles[manager] || []
      ).concat(packageFiles);
    }
  }
  logger.debug(`Found ${fileCount} package file(s)`);

  // If enabledManagers is non-empty, check that each of them has at least one extraction.
  // If not, log a warning to indicate possible misconfiguration.
  if (isNonEmptyArray(config.enabledManagers)) {
    for (const enabledManager of config.enabledManagers) {
      if (
        !(enabledManager.replace('custom.', '') in extractResult.packageFiles)
      ) {
        logger.debug(
          { manager: enabledManager },
          `Manager explicitly enabled in "enabledManagers" config, but found no results. Possible config error?`,
        );
      }
    }
  }

  return extractResult;
}
