import fs from 'fs-extra';
import { GlobalConfig } from '../../config/global';
import { applySecretsToConfig } from '../../config/secrets';
import type { RenovateConfig } from '../../config/types';
import { pkg } from '../../expose.cjs';
import { logger, setMeta } from '../../logger';
import { platform } from '../../platform';
import { removeDanglingContainers } from '../../util/exec/docker';
import { deleteLocalFile, privateCacheDir } from '../../util/fs';
import { branchExists } from '../../util/git';
import * as queue from '../../util/http/queue';
import { addSplit, getSplits, splitInit } from '../../util/split';
import { RepositoryStatisticsReporter } from '../../util/stats-reporter';
import { BranchConfig } from '../types';
import { setBranchCache } from './cache';
import { ensureDependencyDashboard } from './dependency-dashboard';
import handleError from './error';
import { finaliseRepo } from './finalise';
import { initRepo } from './init';
import { ensureOnboardingPr } from './onboarding/pr';
import { extractDependencies, updateRepo } from './process';
import { ProcessResult, processResult } from './result';
import { printRequestStats } from './stats';

async function collectRepositoryStats(
  config: RenovateConfig,
  branches: BranchConfig[]
): Promise<void> {
  const repositoryStats = RepositoryStatisticsReporter.get();
  repositoryStats.repository = config.repository;
  for (const branch of branches) {
    for (const upgrade of branch.upgrades) {
      const depName = upgrade.depName;
      const depCurrentVersion = upgrade.currentVersion;
      const depCurrentDigest = upgrade.currentDigest;
      const depNewVersion = upgrade.newVersion;
      const depNewDigest = upgrade.newDigest;
      const depDatasource = upgrade.datasource;
      let prCreatedAt = '';
      let prUpdatedAt = '';
      let prClosedAt = '';
      let prState = '';
      let branchState = 'deleted';
      let branchStatus = '';
      if (branchExists(branch.branchName)) {
        branchState = 'open';
        branchStatus = await platform.getBranchStatus(branch.branchName);
      }

      if (branch.prNo) {
        const pr = await platform.getPr(branch.prNo);
        prCreatedAt = pr.createdAt;
        prClosedAt = pr.closedAt;
        prUpdatedAt = pr.updatedAt;
        prState = pr.state;
      }
      repositoryStats.dependencyUpdates.push({
        branch: branch.branchName,
        prCreatedAt,
        prClosedAt,
        prUpdatedAt,
        branchState:
          RepositoryStatisticsReporter.getBranchState(branch.branchName) ??
          branchState,
        branchStatus,
        prState:
          RepositoryStatisticsReporter.getPrState(branch.prNo) ?? prState,
        datasource: depDatasource,
        depName: depName,
        depCurrentVersion,
        depNewVersion,
        depCurrentDigest,
        depNewDigest,
        prNumber: branch.prNo,
      });
    }
  }
  RepositoryStatisticsReporter.save(repositoryStats);
  await RepositoryStatisticsReporter.saveStatsToReportFile(
    config.jsonReportFilePath
  );
  logger.debug(repositoryStats, 'repository statistics');
}

// istanbul ignore next
export async function renovateRepository(
  repoConfig: RenovateConfig,
  canRetry = true
): Promise<ProcessResult> {
  splitInit();
  let config = GlobalConfig.set(
    applySecretsToConfig(repoConfig, undefined, false)
  );
  await removeDanglingContainers();
  setMeta({ repository: config.repository });
  logger.info({ renovateVersion: pkg.version }, 'Repository started');
  logger.trace({ config });
  let repoResult: ProcessResult;
  queue.clear();
  const { localDir } = GlobalConfig.get();
  try {
    await fs.ensureDir(localDir);
    logger.debug('Using localDir: ' + localDir);
    config = await initRepo(config);
    RepositoryStatisticsReporter.initRepoStats(config.repository);
    addSplit('init');
    const { branches, branchList, packageFiles } = await extractDependencies(
      config
    );
    await ensureOnboardingPr(config, packageFiles, branches);
    const res = await updateRepo(config, branches);
    setMeta({ repository: config.repository });
    addSplit('update');
    await setBranchCache(branches);
    if (res === 'automerged') {
      if (canRetry) {
        logger.info('Renovating repository again after automerge result');
        const recursiveRes = await renovateRepository(repoConfig, false);
        return recursiveRes;
      }
      logger.debug(`Automerged but already retried once`);
    } else {
      await ensureDependencyDashboard(config, branches);
    }
    await finaliseRepo(config, branchList);
    repoResult = processResult(config, res);
    await collectRepositoryStats(config, branches);
  } catch (err) /* istanbul ignore next */ {
    setMeta({ repository: config.repository });
    const errorRes = await handleError(config, err);
    repoResult = processResult(config, errorRes);
  }
  if (localDir && !config.persistRepoData) {
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
  logger.info({ durationMs: splits.total }, 'Repository finished');
  return repoResult;
}
