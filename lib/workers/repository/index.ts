import fs from 'fs-extra';
import { GlobalConfig } from '../../config/global';
import { applySecretsAndVariablesToConfig } from '../../config/secrets';
import type { RenovateConfig } from '../../config/types';
import {
  REPOSITORY_DISABLED_BY_CONFIG,
  REPOSITORY_FORKED,
  REPOSITORY_NO_CONFIG,
} from '../../constants/error-messages';
import { pkg } from '../../expose.cjs';
import { instrument } from '../../instrumentation';
import { addExtractionStats } from '../../instrumentation/reporting';
import { logger, setMeta } from '../../logger';
import { resetRepositoryLogLevelRemaps } from '../../logger/remap';
import { removeDanglingContainers } from '../../util/exec/docker';
import { deleteLocalFile, privateCacheDir } from '../../util/fs';
import { isCloned } from '../../util/git';
import { detectSemanticCommits } from '../../util/git/semantic';
import * as queue from '../../util/http/queue';
import * as throttle from '../../util/http/throttle';
import { addSplit, getSplits, splitInit } from '../../util/split';
import {
  AbandonedPackageStats,
  DatasourceCacheStats,
  HttpCacheStats,
  HttpStats,
  LookupStats,
  ObsoleteCacheHitLogger,
  PackageCacheStats,
} from '../../util/stats';
import { setBranchCache } from './cache';
import { extractRepoProblems } from './common';
import { configMigration } from './config-migration';
import { ensureDependencyDashboard } from './dependency-dashboard';
import handleError from './error';
import { finalizeRepo } from './finalize';
import { pruneStaleBranches } from './finalize/prune';
import { initRepo } from './init';
import { OnboardingState } from './onboarding/common';
import { ensureOnboardingPr } from './onboarding/pr';
import { extractDependencies, updateRepo } from './process';
import type { ExtractResult } from './process/extract-update';
import type { ProcessResult } from './result';
import { processResult } from './result';

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
      let errorRes: string | undefined;
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
    const extractResult = await instrument('extract', () =>
      performExtract ? extractDependencies(config) : emptyExtract(config),
    );
    addExtractionStats(config, extractResult);

    const { branches, branchList, packageFiles } = extractResult;

    if (config.semanticCommits === 'auto') {
      config.semanticCommits = await detectSemanticCommits();
    }

    if (
      GlobalConfig.get('dryRun') !== 'lookup' &&
      GlobalConfig.get('dryRun') !== 'extract'
    ) {
      await instrument('onboarding', () =>
        ensureOnboardingPr(config, packageFiles, branches),
      );
      addSplit('onboarding');
      const res = await instrument('update', () =>
        updateRepo(config, branches),
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
function emptyExtract(config: RenovateConfig): ExtractResult {
  return {
    branches: [],
    branchList: [config.onboardingBranch!], // to prevent auto closing
    packageFiles: {},
  };
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
