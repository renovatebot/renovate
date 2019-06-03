const fs = require('fs-extra');
const upath = require('upath');
const { getInstalledPath } = require('get-installed-path');
const { exec } = require('child-process-promise');

module.exports = {
  generateLockFile,
};

async function generateLockFile(cwd, env, config = {}, upgrades = []) {
  const { binarySource } = config;
  logger.debug(`Spawning yarn install to create ${cwd}/yarn.lock`);
  let lockFile = null;
  let stdout;
  let stderr;
  let cmd;
  try {
    const startTime = process.hrtime();
    try {
      // See if renovate is installed locally
      const installedPath = upath.join(
        await getInstalledPath('yarn', {
          local: true,
        }),
        'bin/yarn.js'
      );
      cmd = `node ${installedPath}`;
      const yarnIntegrity =
        config.upgrades &&
        config.upgrades.some(upgrade => upgrade.yarnIntegrity);
      if (!yarnIntegrity) {
        try {
          const renovatePath = await getInstalledPath('renovate', {
            local: true,
          });
          logger.info('Using nested bundled yarn@1.9.4 for install');
          cmd = 'node ' + upath.join(renovatePath, 'bin/yarn-1.9.4.js');
        } catch (err) {
          logger.info('Using bundled yarn@1.9.4 for install');
          cmd = cmd.replace(
            'node_modules/yarn/bin/yarn.js',
            'bin/yarn-1.9.4.js'
          );
        }
      }
    } catch (localerr) {
      logger.debug('No locally installed yarn found');
      // Look inside globally installed renovate
      try {
        const renovateLocation = await getInstalledPath('renovate');
        const installedPath = upath.join(
          await getInstalledPath('yarn', {
            local: true,
            cwd: renovateLocation,
          }),
          'bin/yarn.js'
        );
        cmd = `node ${installedPath}`;
      } catch (nestederr) {
        logger.debug('Could not find globally nested yarn');
        // look for global yarn
        try {
          const installedPath = upath.join(
            await getInstalledPath('yarn'),
            'bin/yarn.js'
          );
          cmd = `node ${installedPath}`;
        } catch (globalerr) {
          logger.warn('Could not find globally installed yarn');
          cmd = 'yarn';
        }
      }
    }
    if (binarySource === 'global') {
      cmd = 'yarn';
    }
    logger.debug(`Using yarn: ${cmd}`);
    let cmdExtras = '';
    cmdExtras += ' --ignore-scripts';
    cmdExtras += ' --ignore-engines';
    cmdExtras += ' --ignore-platform';
    cmdExtras += process.env.YARN_MUTEX_FILE
      ? ` --mutex file:${process.env.YARN_MUTEX_FILE}`
      : ' --mutex network:31879';
    const installCmd = cmd + ' install' + cmdExtras;
    // TODO: Switch to native util.promisify once using only node 8
    ({ stdout, stderr } = await exec(installCmd, {
      cwd,
      shell: true,
      env,
    }));
    logger.debug(`yarn stdout:\n${stdout}`);
    logger.debug(`yarn stderr:\n${stderr}`);
    const lockUpdates = upgrades
      .filter(upgrade => upgrade.isLockfileUpdate)
      .map(upgrade => upgrade.depName);
    if (lockUpdates.length) {
      logger.info('Performing lockfileUpdate (yarn)');
      const updateCmd =
        cmd +
        ' upgrade' +
        lockUpdates.map(depName => ` ${depName}`).join('') +
        cmdExtras;
      const updateRes = await exec(updateCmd, {
        cwd,
        shell: true,
        env,
      });
      stdout += updateRes.stdout
        ? /* istanbul ignore next */ updateRes.stdout
        : '';
      stderr += updateRes.stderr
        ? /* istanbul ignore next */ updateRes.stderr
        : '';
    }
    if (
      config.postUpdateOptions &&
      config.postUpdateOptions.includes('yarnDedupeFewer')
    ) {
      logger.info('Performing yarn dedupe fewer');
      const dedupeCommand =
        'npx yarn-deduplicate@1.1.1 --strategy fewer && yarn';
      const dedupeRes = await exec(dedupeCommand, {
        cwd,
        shell: true,
        env,
      });
      stdout += dedupeRes.stdout
        ? /* istanbul ignore next */ dedupeRes.stdout
        : '';
      stderr += dedupeRes.stderr
        ? /* istanbul ignore next */ dedupeRes.stderr
        : '';
    }
    if (
      config.postUpdateOptions &&
      config.postUpdateOptions.includes('yarnDedupeHighest')
    ) {
      logger.info('Performing yarn dedupe highest');
      const dedupeCommand =
        'npx yarn-deduplicate@1.1.1 --strategy highest && yarn';
      const dedupeRes = await exec(dedupeCommand, {
        cwd,
        shell: true,
        env,
      });
      stdout += dedupeRes.stdout
        ? /* istanbul ignore next */ dedupeRes.stdout
        : '';
      stderr += dedupeRes.stderr
        ? /* istanbul ignore next */ dedupeRes.stderr
        : '';
    }
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    lockFile = await fs.readFile(upath.join(cwd, 'yarn.lock'), 'utf8');
    logger.info(
      { seconds, type: 'yarn.lock', stdout, stderr },
      'Generated lockfile'
    );
  } catch (err) /* istanbul ignore next */ {
    logger.info(
      {
        cmd,
        err,
        stdout,
        stderr,
        type: 'yarn',
      },
      'lock file error'
    );
    if (err.stderr) {
      if (err.stderr.includes('ENOSPC: no space left on device')) {
        throw new Error('disk-space');
      }
      if (
        err.stderr.includes('The registry may be down.') ||
        err.stderr.includes('getaddrinfo ENOTFOUND registry.yarnpkg.com') ||
        err.stderr.includes('getaddrinfo ENOTFOUND registry.npmjs.org')
      ) {
        throw new Error('registry-failure');
      }
    }
    return { error: true, stderr: err.stderr };
  }
  return { lockFile };
}
