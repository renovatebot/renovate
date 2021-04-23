import fs from 'fs-extra';
import { setAdminConfig } from '../../config/admin';
import type { RenovateConfig } from '../../config/types';
import { logger, setMeta } from '../../logger';
import { deleteLocalFile, privateCacheDir } from '../../util/fs';
import * as queue from '../../util/http/queue';
import { addSplit, getSplits, splitInit } from '../../util/split';
import { setBranchCache } from './cache';
import { ensureMasterIssue } from './dependency-dashboard';
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
  repoConfig: RenovateConfig
): Promise<ProcessResult> {
  splitInit();
  let config = { ...repoConfig };
  setAdminConfig(config);
  setMeta({ repository: config.repository });
  logger.info({ renovateVersion }, 'Repository started');
  logger.trace({ config });
  let repoResult: ProcessResult;
  queue.clear();
  try {
    await fs.ensureDir(config.localDir);
    logger.debug('Using localDir: ' + config.localDir);
    config = await initRepo(config);
    addSplit('init');
    const { branches, branchList, packageFiles } = await extractDependencies(
      config
    );
    await ensureOnboardingPr(config, packageFiles, branches);
    const res = await updateRepo(config, branches);
    addSplit('update');
    await setBranchCache(branches);
    if (res !== 'automerged') {
      await ensureMasterIssue(config, branches);
    }
    await finaliseRepo(config, branchList);
    repoResult = processResult(config, res);
  } catch (err) /* istanbul ignore next */ {
    setMeta({ repository: config.repository });
    const errorRes = await handleError(config, err);
    repoResult = processResult(config, errorRes);
  }
  if (config.localDir && !config.persistRepoData) {
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
