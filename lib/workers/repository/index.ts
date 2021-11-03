import fs from 'fs-extra';
import { getGlobalConfig, setGlobalConfig } from '../../config/global';
import type { RenovateConfig } from '../../config/types';
import { logger, setMeta } from '../../logger';
import { removeDanglingContainers } from '../../util/exec/docker';
import { deleteLocalFile, privateCacheDir } from '../../util/fs';
import * as queue from '../../util/http/queue';
import { addSplit, getSplits, splitInit } from '../../util/split';
import { setBranchCache } from './cache';
import { ensureDependencyDashboard } from './dependency-dashboard';
import handleError from './error';
import { finaliseRepo } from './finalise';
import { initRepo } from './init';
import { ensureOnboardingPr } from './onboarding/pr';
import { extractDependencies, updateRepo } from './process';
import { ProcessResult, processResult } from './result';
import { printRequestStats } from './stats';

let renovateVersion = 'unknown';
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  renovateVersion = require('../../../package.json').version; // eslint-disable-line global-require
} catch (err) /* istanbul ignore next */ {
  logger.debug({ err }, 'Error getting renovate version');
}

// istanbul ignore next
export async function renovateRepository(
  repoConfig: RenovateConfig,
  canRetry = true
): Promise<ProcessResult> {
  splitInit();
  let config = setGlobalConfig(repoConfig);
  await removeDanglingContainers();
  setMeta({ repository: config.repository });
  logger.info({ renovateVersion }, 'Repository started');
  logger.trace({ config });
  let repoResult: ProcessResult;
  queue.clear();
  const { localDir } = getGlobalConfig();
  try {
    await fs.ensureDir(localDir);
    logger.debug('Using localDir: ' + localDir);
    config = await initRepo(config);
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
