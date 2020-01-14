import { outputFile, readFile } from 'fs-extra';
import { join, dirname } from 'upath';
import { exec } from '../../util/exec';
import { getChildProcessEnv } from '../../util/exec/env';
import { logger } from '../../logger';
import { getPkgReleases } from '../../datasource/docker';
import {
  isValid,
  isVersion,
  matches,
  sortVersions,
} from '../../versioning/ruby';
import { UpdateArtifactsConfig, UpdateArtifactsResult } from '../common';
import { platform } from '../../platform';
import {
  BUNDLER_COULD_NOT_RESOLVE,
  BUNDLER_INVALID_CREDENTIALS,
  BUNDLER_UNKNOWN_ERROR,
} from '../../constants/error-messages';

export async function updateArtifacts(
  packageFileName: string,
  updatedDeps: string[],
  newPackageFileContent: string,
  config: UpdateArtifactsConfig
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`bundler.updateArtifacts(${packageFileName})`);
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
  const cwd = join(config.localDir, dirname(packageFileName));
  let stdout: string;
  let stderr: string;
  try {
    const localPackageFileName = join(config.localDir, packageFileName);
    await outputFile(localPackageFileName, newPackageFileContent);
    const localLockFileName = join(config.localDir, lockFileName);
    const env = getChildProcessEnv();
    const startTime = process.hrtime();
    let cmd;
    if (config.binarySource === 'docker') {
      logger.info('Running bundler via docker');
      let tag = 'latest';
      let rubyConstraint: string;
      if (config && config.compatibility && config.compatibility.ruby) {
        logger.debug('Using rubyConstraint from config');
        rubyConstraint = config.compatibility.ruby;
      } else {
        const rubyVersionFile = join(dirname(packageFileName), '.ruby-version');
        logger.debug('Checking ' + rubyVersionFile);
        const rubyVersionFileContent = await platform.getFile(rubyVersionFile);
        if (rubyVersionFileContent) {
          logger.debug('Using ruby version specified in .ruby-version');
          rubyConstraint = rubyVersionFileContent
            .replace(/^ruby-/, '')
            .replace(/\n/g, '')
            .trim();
        }
      }
      if (rubyConstraint && isValid(rubyConstraint)) {
        logger.debug({ rubyConstraint }, 'Found ruby compatibility');
        const rubyReleases = await getPkgReleases({
          lookupName: 'renovate/ruby',
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
        if (tag === 'latest') {
          logger.warn(
            { rubyConstraint },
            'Failed to find a tag satisfying ruby constraint, using latest ruby image instead'
          );
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
      if (config.dockerUser) {
        cmd += `--user=${config.dockerUser} `;
      }
      const volumes = [config.localDir];
      cmd += volumes.map(v => `-v "${v}":"${v}" `).join('');
      cmd += `-w "${cwd}" `;
      cmd += `renovate/ruby:${tag} bash -l -c "ruby --version && `;
      cmd += 'gem install bundler' + bundlerVersion + ' --no-document';
      cmd += ' && bundle';
    } else if (
      config.binarySource === 'auto' ||
      config.binarySource === 'global'
    ) {
      logger.info('Running bundler via global bundler');
      cmd = 'bundle';
    } else {
      logger.warn({ config }, 'Unsupported binarySource');
      cmd = 'bundle';
    }
    cmd += ` lock --update ${updatedDeps.join(' ')}`;
    if (cmd.includes('bash -l -c "')) {
      cmd += '"';
    }
    logger.debug({ cmd }, 'bundler command');
    ({ stdout, stderr } = await exec(cmd, {
      cwd,
      env,
    }));
    const duration = process.hrtime(startTime);
    const seconds = Math.round(duration[0] + duration[1] / 1e9);
    logger.info(
      { seconds, type: 'Gemfile.lock', stdout, stderr },
      'Generated lockfile'
    );
    const status = await platform.getRepoStatus();
    if (!status.modified.includes(lockFileName)) {
      return null;
    }
    logger.debug('Returning updated Gemfile.lock');
    return [
      {
        file: {
          name: lockFileName,
          contents: await readFile(localLockFileName, 'utf8'),
        },
      },
    ];
  } catch (err) /* istanbul ignore next */ {
    if (
      (err.stdout &&
        err.stdout.includes('Please supply credentials for this source')) ||
      (err.stderr && err.stderr.includes('Authentication is required'))
    ) {
      logger.warn(
        { err },
        'Gemfile.lock update failed due to missing credentials'
      );
      global.repoCache.bundlerArtifactsError = BUNDLER_INVALID_CREDENTIALS;
      throw new Error(BUNDLER_INVALID_CREDENTIALS);
    }
    const resolveMatchRe = new RegExp('\\s+(.*) was resolved to', 'g');
    if (err.stderr && err.stderr.match(resolveMatchRe)) {
      logger.debug({ err }, 'Bundler has a resolve error');
      const resolveMatches = [];
      let resolveMatch;
      do {
        resolveMatch = resolveMatchRe.exec(err.stderr);
        if (resolveMatch) {
          resolveMatches.push(resolveMatch[1].split(' ').shift());
        }
      } while (resolveMatch);
      if (resolveMatches.some(match => !updatedDeps.includes(match))) {
        logger.debug(
          { resolveMatches, updatedDeps },
          'Found new resolve matches - reattempting recursively'
        );
        const newUpdatedDeps = [
          ...new Set([...updatedDeps, ...resolveMatches]),
        ];
        return updateArtifacts(
          packageFileName,
          newUpdatedDeps,
          newPackageFileContent,
          config
        );
      }
      logger.warn({ err }, 'Cannot resolve bundler lock update error');
      // Do not set global.repoCache because we don't want to stop trying other branches
      throw new Error(BUNDLER_COULD_NOT_RESOLVE);
    }
    logger.warn({ err }, 'Unknown bundler lock file update error');
    global.repoCache.bundlerArtifactsError = BUNDLER_UNKNOWN_ERROR;
    throw new Error(BUNDLER_UNKNOWN_ERROR);
  }
}
