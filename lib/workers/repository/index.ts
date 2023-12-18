import fs from 'fs-extra';
import { GlobalConfig } from '../../config/global';
import { applySecretsToConfig } from '../../config/secrets';
import type { RenovateConfig } from '../../config/types';
import {
  REPOSITORY_DISABLED_BY_CONFIG,
  REPOSITORY_FORKED,
  REPOSITORY_NO_CONFIG,
} from '../../constants/error-messages';
import { pkg } from '../../expose.cjs';
import { instrument } from '../../instrumentation';
import { logger, setMeta } from '../../logger';
import { removeDanglingContainers } from '../../util/exec/docker';
import { deleteLocalFile, privateCacheDir } from '../../util/fs';
import { isCloned } from '../../util/git';
import { detectSemanticCommits } from '../../util/git/semantic';
import { clearDnsCache, printDnsStats } from '../../util/http/dns';
import * as queue from '../../util/http/queue';
import * as throttle from '../../util/http/throttle';
import { addSplit, getSplits, splitInit } from '../../util/split';
import { setBranchCache } from './cache';
import { extractRepoProblems } from './common';
import { ensureDependencyDashboard } from './dependency-dashboard';
import handleError from './error';
import { finalizeRepo } from './finalize';
import { pruneStaleBranches } from './finalize/prune';
import { initRepo } from './init';
import { OnboardingState } from './onboarding/common';
import { ensureOnboardingPr } from './onboarding/pr';
import { extractDependencies, updateRepo } from './process';
import type { ExtractResult } from './process/extract-update';
import { ProcessResult, processResult } from './result';
import { printLookupStats, printRequestStats } from './stats';

// istanbul ignore next
export async function renovateRepository(
  repoConfig: RenovateConfig,
  canRetry = true,
): Promise<ProcessResult | undefined> {
  splitInit();
  let config = GlobalConfig.set(
    applySecretsToConfig(repoConfig, undefined, false),
  );
  await removeDanglingContainers();
  setMeta({ repository: config.repository });
  logger.info({ renovateVersion: pkg.version }, 'Repository started');
  logger.trace({ config });
  let repoResult: ProcessResult | undefined;
  queue.clear();
  throttle.clear();
  const localDir = GlobalConfig.get('localDir')!;
  try {
    await fs.ensureDir(localDir);
    logger.debug('Using localDir: ' + localDir);
    config = await initRepo(config);
    addSplit('init');
    const performExtract =
      config.repoIsOnboarded! ||
      !OnboardingState.onboardingCacheValid ||
      OnboardingState.prUpdateRequested;
    const { branches, branchList, packageFiles } = performExtract
      ? await instrument('extract', () => extractDependencies(config))
      : emptyExtract(config);
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
        await ensureDependencyDashboard(config, branches, packageFiles);
      }
      await finalizeRepo(config, branchList);
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
  printRequestStats();
  printLookupStats();
  printDnsStats();
  clearDnsCache();
  const cloned = isCloned();
  logger.info({ cloned, durationMs: splits.total }, 'Repository finished');
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
