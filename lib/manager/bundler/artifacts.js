const { exec } = require('child-process-promise');
const upath = require('upath');

module.exports = {
  // Public
  getArtifacts,

  // Private
  runBundleUpdate,
};

/**
 * Runs bundle lock --update on
 * @param config object Configuration options passed to bundler
 * @param updatedDeps string[] An array of gems that were updated
 */
async function runBundleUpdate(config, updatedDeps) {
  const env =
    config.global && config.global.trustLevel === 'high'
      ? process.env
      : {
          HOME: process.env.HOME,
          PATH: process.env.PATH,
        };
  const cwd = upath.join(config.localDir, upath.dirname('Gemfile'));
  ({ stdout, stderr } = await exec(
    `bundle lock --update ${updatedDeps.join(' ')}`,
    {
      cwd,
      shell: true,
      env,
    }
  ));

  return {
    stdout,
    stderr,
  };
}

/*
 *  The getArtifacts() function is optional and necessary only if it is necessary to update "artifacts"
 *  after updating package files. Artifacts are files such as lock files or checksum files.
 *  Usually this will require running a child process command to produce an update.
 */

async function getArtifacts(
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config
) {
  await logger.debug({ config }, `bundler.getArtifacts(${packageFileName})`);

  const lockFileName = `${packageFileName}.lock`;
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No bundler.lock found');
    return null;
  }

  const { stdout, stderr } = await runBundleUpdate(config, updatedDeps);

  if (config.gitFs) {
    const status = await platform.getRepoStatus();
    if (!status.modified.includes(lockFileName)) {
      return null;
    }
  } else {
    const newLockFileContent = await fs.readFile(localLockFileName, 'utf8');

    if (newLockFileContent === existingLockFileContent) {
      logger.debug('Gemfile.lock is unchanged');
      return null;
    }
  }

  logger.debug('Returning updated Gemfile.lock');
  return {
    file: {
      name: lockFileName,
      contents: await fs.readFile(localLockFileName, 'utf8'),
    },
  };
}
