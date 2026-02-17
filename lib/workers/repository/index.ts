import fs from 'fs-extra';
import { GlobalConfig } from '../../config/global.ts';
import { applySecretsAndVariablesToConfig } from '../../config/secrets.ts';
import type { RenovateConfig } from '../../config/types.ts';
import {
  REPOSITORY_DISABLED_BY_CONFIG,
  REPOSITORY_FORKED,
  REPOSITORY_NO_CONFIG,
} from '../../constants/error-messages.ts';
import { pkg } from '../../expose.ts';
import { instrument } from '../../instrumentation/index.ts';
import { addExtractionStats } from '../../instrumentation/reporting.ts';
import { ATTR_RENOVATE_SPLIT } from '../../instrumentation/types.ts';
import { logger, setMeta } from '../../logger/index.ts';
import { resetRepositoryLogLevelRemaps } from '../../logger/remap.ts';
import { getInheritedOrGlobal } from '../../util/common.ts';
import { removeDanglingContainers } from '../../util/exec/docker/index.ts';
import { deleteLocalFile, privateCacheDir } from '../../util/fs/index.ts';
import { isCloned } from '../../util/git/index.ts';
import { detectSemanticCommits } from '../../util/git/semantic.ts';
import * as queue from '../../util/http/queue.ts';
import * as throttle from '../../util/http/throttle.ts';
import { addSplit, getSplits, splitInit } from '../../util/split.ts';
import {
  AbandonedPackageStats,
  DatasourceCacheStats,
  GitOperationStats,
  HttpCacheStats,
  HttpStats,
  LookupStats,
  ObsoleteCacheHitLogger,
  PackageCacheStats,
} from '../../util/stats.ts';
import { setBranchCache } from './cache.ts';
import { extractRepoProblems } from './common.ts';
import { configMigration } from './config-migration/index.ts';
import { ensureDependencyDashboard } from './dependency-dashboard.ts';
import handleError from './error.ts';
import { finalizeRepo } from './finalize/index.ts';
import { pruneStaleBranches } from './finalize/prune.ts';
import { initRepo } from './init/index.ts';
import { OnboardingState } from './onboarding/common.ts';
import { ensureOnboardingPr } from './onboarding/pr/index.ts';
import type { ExtractResult } from './process/extract-update.ts';
import { extractDependencies, updateRepo } from './process/index.ts';
import type { ProcessResult, RepositoryResult } from './result.ts';
import { processResult } from './result.ts';

// istanbul ignore next
export async function renovateRepository(
  repoConfig: RenovateConfig,
  canRetry = true,
): Promise<ProcessResult | undefined> {
  splitInit();

  let repoResult: ProcessResult | undefined;
  const { config, localDir, errorRes } = await instrument(
    'init',
    async (): Promise<{
      config: RenovateConfig;
      localDir: string;
      errorRes?: string;
    }> => {
      let errorRes: RepositoryResult | undefined;
      let config = GlobalConfig.set(
        applySecretsAndVariablesToConfig({
          config: repoConfig,
          deleteVariables: false,
          deleteSecrets: false,
        }),
      );
      await removeDanglingContainers();
      setMeta({ repository: config.repository });
      logger.info({ renovateVersion: pkg.version }, 'Repository started');
      logger.trace({ config });
      queue.clear();
      throttle.clear();
      const localDir = GlobalConfig.get('localDir')!;

      try {
        await fs.ensureDir(localDir);
        logger.debug('Using localDir: ' + localDir);
        config = await initRepo(config);
        addSplit('init');
      } catch (err) /* istanbul ignore next */ {
        setMeta({ repository: config.repository });
        errorRes = await handleError(config, err);
        const pruneWhenErrors = [
          REPOSITORY_DISABLED_BY_CONFIG,
          REPOSITORY_FORKED,
          REPOSITORY_NO_CONFIG,
        ];
        if (pruneWhenErrors.includes(errorRes)) {
          await pruneStaleBranches(config, []);
        }
        repoResult = processResult(config, errorRes);
      }

      return { config, localDir, errorRes };
    },
    {
      attributes: {
        [ATTR_RENOVATE_SPLIT]: 'init',
      },
    },
  );

  try {
    // only continue if init stage was successful
    if (errorRes) {
      throw new Error(errorRes);
    }

    const performExtract =
      config.repoIsOnboarded! ||
      !OnboardingState.onboardingCacheValid ||
      OnboardingState.prUpdateRequested;
    const extractResult = performExtract
      ? await extractDependencies(config)
      : emptyExtract();
    addExtractionStats(config, extractResult);

    const { branches, branchList, packageFiles } = extractResult;

    if (config.semanticCommits === 'auto') {
      config.semanticCommits = await detectSemanticCommits();
    }

    if (
      GlobalConfig.get('dryRun') !== 'lookup' &&
      GlobalConfig.get('dryRun') !== 'extract'
    ) {
      await instrument(
        'onboarding',
        () => ensureOnboardingPr(config, packageFiles, branches),
        {
          attributes: {
            [ATTR_RENOVATE_SPLIT]: 'onboarding',
          },
        },
      );
      addSplit('onboarding');
      const res = await instrument(
        'update',
        () => updateRepo(config, branches),
        {
          attributes: {
            [ATTR_RENOVATE_SPLIT]: 'update',
          },
        },
      );
      setMeta({ repository: config.repository });
      addSplit('update');
      if (performExtract) {
        await setBranchCache(branches); // update branch cache if performed extraction
      }
      if (res === 'automerged') {
        if (canRetry) {
          logger.info('Restarting repository job after automerge result');
          const recursiveRes = await renovateRepository(repoConfig, false);
          return recursiveRes;
        }
        logger.debug(`Automerged but already retried once`);
      } else {
        const configMigrationRes = await configMigration(config, branchList);
        await ensureDependencyDashboard(
          config,
          branches,
          packageFiles,
          configMigrationRes,
        );
      }
      await finalizeRepo(config, branchList, repoConfig);
      // TODO #22198
      repoResult = processResult(config, res!);
    }
    printRepositoryProblems(config.repository);
  } catch (err) /* istanbul ignore next */ {
    setMeta({ repository: config.repository });
    const errorRes = await handleError(config, err);
    const pruneWhenErrors = [
      REPOSITORY_DISABLED_BY_CONFIG,
      REPOSITORY_FORKED,
      REPOSITORY_NO_CONFIG,
    ];
    if (pruneWhenErrors.includes(errorRes)) {
      await pruneStaleBranches(config, []);
    }
    repoResult = processResult(config, errorRes);
  }
  if (localDir && !repoConfig.persistRepoData) {
    try {
      await deleteLocalFile('.');
    } catch (err) /* istanbul ignore if */ {
      logger.warn({ err }, 'localDir deletion error');
    }
  }
  try {
    await fs.remove(privateCacheDir());
  } catch (err) /* istanbul ignore if */ {
    logger.warn({ err }, 'privateCacheDir deletion error');
  }
  const splits = getSplits();
  logger.debug(splits, 'Repository timing splits (milliseconds)');
  PackageCacheStats.report();
  DatasourceCacheStats.report();
  HttpStats.report();
  HttpCacheStats.report();
  LookupStats.report();
  ObsoleteCacheHitLogger.report();
  AbandonedPackageStats.report();
  GitOperationStats.report();
  const cloned = isCloned();
  /* v8 ignore next 11 -- coverage not required of these `undefined` checks, as we're happy receiving an `undefined` in the logs */
  logger.info(
    {
      cloned,
      durationMs: splits.total,
      result: repoResult?.res,
      status: repoResult?.status,
      enabled: repoResult?.enabled,
      onboarded: repoResult?.onboarded,
    },
    'Repository finished',
  );
  resetRepositoryLogLevelRemaps();
  return repoResult;
}

// istanbul ignore next: renovateRepository is ignored
function emptyExtract(): ExtractResult {
  return instrument(
    'extract',
    () => {
      addSplit('extract');
      addSplit('lookup');
      return {
        branches: [],
        branchList: [getInheritedOrGlobal('onboardingBranch')!], // to prevent auto closing
        packageFiles: {},
      };
    },
    {
      attributes: {
        [ATTR_RENOVATE_SPLIT]: 'extract',
      },
    },
  );
}

export function printRepositoryProblems(repository: string | undefined): void {
  const repoProblems = extractRepoProblems(repository);
  if (repoProblems.size) {
    logger.debug(
      { repoProblems: Array.from(repoProblems) },
      'repository problems',
    );
  }
}
