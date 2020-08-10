import fs from 'fs-extra';
import { RenovateConfig } from '../../config';
import { logger, setMeta } from '../../logger';
import { deleteLocalFile } from '../../util/fs';
import { addSplit, getSplits, splitInit } from '../../util/split';
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
  setMeta({ repository: config.repository });
  logger.info({ renovateVersion }, 'Repository started');
  logger.trace({ config });
  let repoResult: ProcessResult;
  try {
    await fs.ensureDir(config.localDir);
    logger.debug('Using localDir: ' + config.localDir);
    config = await initRepo(config);
    addSplit('init');
    const { branches, branchList, packageFiles } = await extractDependencies(
      config
    );
    await ensureOnboardingPr(config, packageFiles, branches);
    const res = await updateRepo(config, branches, branchList);
    addSplit('update');
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
    await deleteLocalFile('.');
  }
  const splits = getSplits();
  logger.debug(splits, 'Repository timing splits (milliseconds)');
  printRequestStats();
  logger.info({ durationMs: splits.total }, 'Repository finished');
  return repoResult;
}
