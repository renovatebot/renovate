import fs from 'fs-extra';

import { RenovateConfig } from '../../config';
import { logger, setMeta } from '../../logger';
import { platform } from '../../platform';
import handleError from './error';
import { finaliseRepo } from './finalise';
import { initRepo } from './init';
import { ensureMasterIssue } from './master-issue';
import { ensureOnboardingPr } from './onboarding/pr';
import { processRepo, updateRepo } from './process';
import { ProcessResult, processResult } from './result';
import { DateTime } from 'luxon';

let renovateVersion = 'unknown';
try {
  renovateVersion = require('../../../package.json').version; // eslint-disable-line global-require
} catch (err) /* istanbul ignore next */ {
  logger.debug({ err }, 'Error getting renovate version');
}

// istanbul ignore next
export async function renovateRepository(
  repoConfig: RenovateConfig
): Promise<ProcessResult> {
  const startTime = Date.now();
  let config = { ...repoConfig };
  setMeta({ repository: config.repository });
  logger.info({ renovateVersion }, 'Repository started');
  logger.trace({ config });
  let repoResult: ProcessResult;
  try {
    await fs.ensureDir(config.localDir);
    logger.debug('Using localDir: ' + config.localDir);
    config = await initRepo(config);
    const { branches, branchList, packageFiles } = await processRepo(config);
    await ensureOnboardingPr(config, packageFiles, branches);
    const res = await updateRepo(config, branches, branchList);
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
  await platform.cleanRepo();
  if (config.localDir && !config.persistRepoData) {
    await fs.remove(config.localDir);
  }
  logger.info({ durationMs: Date.now() - startTime }, 'Repository finished');
  return repoResult;
}
