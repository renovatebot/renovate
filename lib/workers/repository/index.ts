import fs from 'fs-extra';
import { GlobalConfig } from '../../config/global';
import { applySecretsToConfig } from '../../config/secrets';
import type { RenovateConfig } from '../../config/types';
import { pkg } from '../../expose.cjs';
import { getTracer } from '../../instrumentation';
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

// istanbul ignore next
export async function renovateRepository(
  repoConfig: RenovateConfig,
  canRetry = true
): Promise<ProcessResult> {
  const tracer = getTracer();

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
    addSplit('init');
    const { branches, branchList, packageFiles } = await tracer.startActiveSpan(
      'extractDependencies',
      async (span) => {
        const res = await extractDependencies(config);
        span.end();
        return res;
      }
    );
    if (
      GlobalConfig.get('dryRun') !== 'lookup' &&
      GlobalConfig.get('dryRun') !== 'extract'
    ) {
      await tracer.startActiveSpan('ensure onboarding PR', async (span) => {
        await ensureOnboardingPr(config, packageFiles, branches);
        span.end();
      });

      const res = await tracer.startActiveSpan(
        'update repository',
        async (span) => {
          const res = await updateRepo(config, branches);
          span.end();
          return res;
        }
      );
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
