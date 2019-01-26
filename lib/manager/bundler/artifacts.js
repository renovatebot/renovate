/* istanbul ignore file */

const { exec } = require('child-process-promise');
const fs = require('fs-extra');
const upath = require('upath');

const { getPkgReleases } = require('../../datasource/docker');
const {
  isValid,
  isVersion,
  matches,
  sortVersions,
} = require('../../versioning/ruby');

module.exports = {
  getArtifacts,
};

async function getArtifacts(
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config
) {
  logger.debug(`bundler.getArtifacts(${packageFileName})`);
  // istanbul ignore if
  if (global.repoCache.bundlerArtifactsError) {
    logger.info('Aborting Bundler artifacts due to previous failed attempt');
    throw new Error(global.repoCache.bundlerArtifactsError);
  }
  const lockFileName = packageFileName + '.lock';
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No Gemfile.lock found');
    return null;
  }
  const cwd = upath.join(config.localDir, upath.dirname(packageFileName));
  let stdout;
  let stderr;
  try {
    const localPackageFileName = upath.join(config.localDir, packageFileName);
    await fs.outputFile(localPackageFileName, newPackageFileContent);
    const localLockFileName = upath.join(config.localDir, lockFileName);
    if (!config.gitFs) {
      await fs.outputFile(localLockFileName, existingLockFileContent);
      const fileList = await platform.getFileList();
      const gemspecs = fileList.filter(file => file.endsWith('.gemspec'));
      for (const gemspec of gemspecs) {
        const content = await platform.getFile(gemspec);
        await fs.outputFile(upath.join(config.localDir, gemspec), content);
      }
    }
    const env =
      global.trustLevel === 'high'
        ? process.env
        : {
            HOME: process.env.HOME,
            PATH: process.env.PATH,
          };
    const startTime = process.hrtime();
    let cmd;
    if (config.binarySource === 'docker') {
      logger.info('Running bundler via docker');
      let tag = 'latest';
      let rubyConstraint;
      const rubyVersionFile = upath.join(
        upath.dirname(packageFileName),
        '.ruby-version'
      );
      logger.debug('Checking ' + rubyVersionFile);
      const rubyVersionFileContent = await platform.getFile(rubyVersionFile);
      if (rubyVersionFileContent) {
        logger.debug('Using ruby version specified in .ruby-version');
        rubyConstraint = rubyVersionFileContent.replace(/\n/g, '').trim();
      } else {
        rubyConstraint =
          config && config.compatibility && config.compatibility.ruby
            ? config.compatibility.ruby
            : undefined;
      }
      if (rubyConstraint && isValid(rubyConstraint)) {
        logger.debug('Found ruby compatibility');
        const rubyReleases = await getPkgReleases({
          fullname: 'renovate/ruby',
          qualifiers: {},
        });
        if (rubyReleases && rubyReleases.releases) {
          let versions = rubyReleases.releases.map(release => release.version);
          versions = versions.filter(version => isVersion(version));
          versions = versions.filter(version =>
            matches(version, rubyConstraint)
          );
          versions = versions.sort(sortVersions);
          if (versions.length) {
            tag = versions.pop();
          }
        }
      }
      const bundlerConstraint =
        config && config.compatibility && config.compatibility.bundler
          ? config.compatibility.bundler
          : undefined;
      let bundlerVersion = '';
      if (bundlerConstraint && isVersion(bundlerConstraint)) {
        bundlerVersion = ' -v ' + bundlerConstraint;
      }
      cmd = `docker run --rm `;
      const volumes = [config.localDir];
      cmd += volumes.map(v => `-v ${v}:${v} `).join('');
      const envVars = [];
      cmd += envVars.map(e => `-e ${e} `);
      cmd += `-w ${cwd} `;
      cmd += `renovate/ruby:${tag} bash -l -c "ruby --version && `;
      cmd += 'gem install bundler' + bundlerVersion;
      cmd += ' && bundle';
    } else {
      logger.info('Running bundler via global bundler');
      cmd = 'bundler';
    }
    cmd += ' lock"';
    logger.debug({ cmd }, 'bundler command');
    ({ stdout, stderr } = await exec(cmd, {
      cwd,
      shell: true,
      env,
    }));
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    logger.info(
      { seconds, type: 'Gemfile.lock', stdout, stderr },
      'Generated lockfile'
    );
    // istanbul ignore if
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
  } catch (err) {
    if (
      err.stdout &&
      err.stdout.includes('No such file or directory') &&
      !config.gitFs
    ) {
      logger.warn(
        { err },
        'It is necessary to run Renovate in gitFs mode - contact your bot administrator'
      );
      global.repoCache.bundlerArtifactsError = 'bundler-fs';
      throw new Error('bundler-fs');
    }
    if (
      err.stdout &&
      err.stdout.includes('Please supply credentials for this source')
    ) {
      logger.warn(
        { err },
        'Gemfile.lock update failed due to missing credentials'
      );
      global.repoCache.bundlerArtifactsError = 'bundler-credentials';
      throw new Error('bundler-credentials');
    }
    logger.info(
      { err, message: err.message },
      'Failed to generate Gemfile.lock (unknown error)'
    );
    throw new Error('bundler-unknown');
  }
}
