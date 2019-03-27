const fs = require('fs-extra');
const upath = require('upath');
const { getInstalledPath } = require('get-installed-path');
const { exec } = require('child-process-promise');

module.exports = {
  generateLockFile,
};

async function generateLockFile(
  cwd,
  env,
  filename,
  config = {},
  upgrades = []
) {
  logger.debug(`Spawning npm install to create ${cwd}/${filename}`);
  const { skipInstalls, binarySource, postUpdateOptions } = config;
  let lockFile = null;
  let stdout;
  let stderr;
  let cmd;
  let args = '';
  try {
    const startTime = process.hrtime();
    try {
      // See if renovate is installed locally
      const installedPath = upath.join(
        await getInstalledPath('npm', {
          local: true,
        }),
        'bin/npm-cli.js'
      );
      cmd = `node ${installedPath}`;
    } catch (localerr) {
      logger.debug('No locally installed npm found');
      // Look inside globally installed renovate
      try {
        const renovateLocation = await getInstalledPath('renovate');
        const installedPath = upath.join(
          await getInstalledPath('npm', {
            local: true,
            cwd: renovateLocation,
          }),
          'bin/npm-cli.js'
        );
        cmd = `node ${installedPath}`;
      } catch (nestederr) {
        logger.debug('Could not find globally nested npm');
        // look for global npm
        try {
          const installedPath = upath.join(
            await getInstalledPath('npm'),
            'bin/npm-cli.js'
          );
          cmd = `node ${installedPath}`;
        } catch (globalerr) {
          logger.warn('Could not find globally installed npm');
          cmd = 'npm';
        }
      }
    }
    if (binarySource === 'global') {
      cmd = 'npm';
    }
    args = `install`;
    if (skipInstalls === false) {
      args += ' --ignore-scripts --no-audit';
    } else {
      args += ' --package-lock-only --no-audit';
    }
    logger.debug(`Using npm: ${cmd} ${args}`);
    // TODO: Switch to native util.promisify once using only node 8
    ({ stdout, stderr } = await exec(`${cmd} ${args}`, {
      cwd,
      shell: true,
      env,
    }));
    logger.debug(`npm stdout:\n${stdout}`);
    logger.debug(`npm stderr:\n${stderr}`);
    const lockUpdates = upgrades.filter(upgrade => upgrade.isLockfileUpdate);
    if (lockUpdates.length) {
      logger.info('Performing lockfileUpdate (npm)');
      const updateCmd =
        `${cmd} ${args}` +
        lockUpdates
          .map(update => ` ${update.depName}@${update.toVersion}`)
          .join('');
      const updateRes = await exec(updateCmd, {
        cwd,
        shell: true,
        env,
      });
      stdout += updateRes.stdout ? updateRes.stdout : '';
      stderr += updateRes.stderr ? updateRes.stderr : '';
    }
    if (postUpdateOptions && postUpdateOptions.includes('npmDedupe')) {
      logger.info('Performing npm dedupe');
      const dedupeRes = await exec(`${cmd} dedupe`, {
        cwd,
        shell: true,
        env,
      });
      stdout += dedupeRes.stdout ? dedupeRes.stdout : '';
      stderr += dedupeRes.stderr ? dedupeRes.stderr : '';
    }
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    lockFile = await fs.readFile(upath.join(cwd, filename), 'utf8');
    logger.info(
      { seconds, type: filename, stdout, stderr },
      'Generated lockfile'
    );
  } catch (err) /* istanbul ignore next */ {
    logger.info(
      {
        cmd,
        args,
        err,
        stdout,
        stderr,
        type: 'npm',
      },
      'lock file error'
    );
    return { error: true, stderr: err.stderr };
  }
  return { lockFile };
}
