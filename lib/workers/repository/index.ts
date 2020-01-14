import fs from 'fs-extra';

import handleError from './error';
import { platform } from '../../platform';
import { logger, setMeta } from '../../logger';
import { initRepo } from './init';
import { ensureOnboardingPr } from './onboarding/pr';
import { processResult, ProcessResult } from './result';
import { processRepo } from './process';
import { finaliseRepo } from './finalise';
import { ensureMasterIssue } from './master-issue';
import { RenovateConfig } from '../../config';

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
  let config = { ...repoConfig };
  setMeta({ repository: config.repository });
  logger.info({ renovateVersion }, 'Renovating repository');
  logger.trace({ config });
  let repoResult: ProcessResult;
  try {
    await fs.ensureDir(config.localDir);
    logger.debug('Using localDir: ' + config.localDir);
    config = await initRepo(config);
    const { res, branches, branchList, packageFiles } = await processRepo(
      config
    );
    await ensureOnboardingPr(config, packageFiles, branches);
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
  logger.info('Finished repository');
  return repoResult;
}
