import handleError from './error';
import { platform } from '../../platform';

const fs = require('fs-extra');
const { logger, setMeta } = require('../../logger');
const { initRepo } = require('./init');
const { ensureOnboardingPr } = require('./onboarding/pr');
const { processResult } = require('./result');
const { processRepo } = require('./process');
const { finaliseRepo } = require('./finalise');
const { ensureMasterIssue } = require('./master-issue');

export { renovateRepository };

// istanbul ignore next
async function renovateRepository(repoConfig) {
  let config = { ...repoConfig };
  setMeta({ repository: config.repository });
  logger.info('Renovating repository');
  logger.trace({ config });
  fs.writeFileSync('./configfromrepowrite.json', JSON.stringify(config, null, 2) , 'utf-8');

  let repoResult;
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
