const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const Git = require('simple-git/promise');

const { initRepo } = require('./init');
const { ensureOnboardingPr } = require('./onboarding/pr');
const { handleError } = require('./error');
const { processResult } = require('./result');
const { processRepo } = require('./process');
const { finaliseRepo } = require('./finalise');
const { ensureMasterIssue } = require('./master-issue');

module.exports = {
  renovateRepository,
};

async function setGitPrivateKey(config) {
  if (config.gitPrivateKey && config.localDir) {
    try {
      const cwd = config.localDir;
      const git = Git(cwd).silent(true);
      await git.raw([
        'config',
        '--global',
        'user.signingkey',
        config.gitPrivateKey,
      ]);
    } catch (err) {
      logger.warn({ err }, 'Error in setting git private key to author');
    }
  }
}

// istanbul ignore next
async function renovateRepository(repoConfig) {
  let config = { ...repoConfig };
  logger.setMeta({ repository: config.repository });
  logger.info('Renovating repository');
  logger.trace({ config });
  let repoResult;
  try {
    if (process.env.RENOVATE_TMPDIR) {
      process.env.TMPDIR = process.env.RENOVATE_TMPDIR;
    }
    const tmpDir = path.join(os.tmpdir(), '/renovate');
    await fs.ensureDir(tmpDir);
    config.localDir =
      config.localDir || path.join(tmpDir, config.platform, config.repository);
    await fs.ensureDir(config.localDir);
    logger.debug('Using localDir: ' + config.localDir);
    await setGitPrivateKey(config);
    config = await initRepo(config);
    const { res, branches, branchList, packageFiles } = await processRepo(
      config
    );
    await ensureOnboardingPr(config, packageFiles, branches);
    await ensureMasterIssue(config, branches);
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
