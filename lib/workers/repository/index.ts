import fs from 'fs-extra';
import { GlobalConfig } from '../../config/global';
import { applySecretsToConfig } from '../../config/secrets';
import type { RenovateConfig } from '../../config/types';
import { pkg } from '../../expose.cjs';
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
import type { SshSocket } from '../global/ssh_socket';

// istanbul ignore next
export async function renovateRepository(
  repoConfig: RenovateConfig,
  sshSocket: SshSocket = undefined,
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
    if (sshSocket) {
      for (var rule of config.hostRules) {
        await sshSocket.addKeyFromHostRule(rule);
      }
    }
    addSplit('init');
    const { branches, branchList, packageFiles } = await extractDependencies(
      config
    );
    if (
      GlobalConfig.get('dryRun') !== 'lookup' &&
      GlobalConfig.get('dryRun') !== 'extract'
    ) {
      await ensureOnboardingPr(config, packageFiles, branches);
      const res = await updateRepo(config, branches);
      setMeta({ repository: config.repository });
      addSplit('update');
      await setBranchCache(branches);
      if (res === 'automerged') {
        if (canRetry) {
          logger.info('Renovating repository again after automerge result');
          const recursiveRes = await renovateRepository(repoConfig, ssh_socket, false);
          return recursiveRes;
        }
        logger.debug(`Automerged but already retried once`);
      } else {
        await ensureDependencyDashboard(config, branches);
      }
      await finaliseRepo(config, branchList);
      repoResult = processResult(config, res);
    }
  } catch (err) /* istanbul ignore next */ {
    setMeta({ repository: config.repository });
    const errorRes = await handleError(config, err);
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
  logger.info({ durationMs: splits.total }, 'Repository finished');
  return repoResult;
}
