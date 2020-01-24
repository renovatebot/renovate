import { outputFile, readFile } from 'fs-extra';
import { join, dirname } from 'upath';
import { exec, ExecOptions } from '../../util/exec';
import { logger } from '../../logger';
import { getPkgReleases } from '../../datasource/docker';
import {
  isValid,
  isVersion,
  matches,
  sortVersions,
} from '../../versioning/ruby';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';
import { platform } from '../../platform';
import {
  BUNDLER_INVALID_CREDENTIALS,
  BUNDLER_UNKNOWN_ERROR,
} from '../../constants/error-messages';

async function getRubyConstraint(
  updateArtifact: UpdateArtifact
): Promise<string> {
  const { packageFileName, config } = updateArtifact;
  const { compatibility = {} } = config;
  logger.warn({ compatibility });
  const { ruby } = compatibility;

  let rubyConstraint: string;
  if (ruby) {
    logger.debug('Using rubyConstraint from config');
    rubyConstraint = ruby;
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
  return rubyConstraint;
}

async function getDockerTag(updateArtifact: UpdateArtifact): Promise<string> {
  const constraint = await getRubyConstraint(updateArtifact);
  if (!constraint) return 'latest';
  if (!isValid(constraint)) {
    logger.warn({ constraint }, 'Invalid constraint');
    return 'latest';
  }
  logger.debug({ constraint }, 'Found ruby compatibility');
  const rubyReleases = await getPkgReleases({
    lookupName: 'renovate/ruby',
  });
  if (rubyReleases && rubyReleases.releases) {
    let versions = rubyReleases.releases.map(release => release.version);
    versions = versions.filter(
      version => isVersion(version) && matches(version, constraint)
    );
    versions = versions.sort(sortVersions);
    if (versions.length) {
      return versions.pop();
    }
  }
  logger.warn(
    { constraint },
    'Failed to find a tag satisfying ruby constraint, using latest ruby image instead'
  );
  return 'latest';
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact
): Promise<UpdateArtifactsResult[] | null> {
  const {
    packageFileName,
    updatedDeps,
    newPackageFileContent,
    config,
  } = updateArtifact;
  const { compatibility = {} } = config;

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
  try {
    const localPackageFileName = join(config.localDir, packageFileName);
    await outputFile(localPackageFileName, newPackageFileContent);
    const localLockFileName = join(config.localDir, lockFileName);
    const cmd = `bundle lock --update ${updatedDeps.join(' ')}`;

    const { bundler } = compatibility;
    const bundlerVersion = bundler && isValid(bundler) ? ` -v ${bundler}` : '';
    const preCommands = [
      'ruby --version',
      `gem install bundler${bundlerVersion} --no-document`,
    ];

    const execOptions: ExecOptions = {
      docker: {
        image: 'renovate/ruby',
        tag: await getDockerTag(updateArtifact),
        preCommands,
      },
    };
    await exec(cmd, execOptions);
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
    const output = err.stdout + err.stderr;
    if (
      err.message.includes('fatal: Could not parse object') ||
      output.includes('but that version could not be found')
    ) {
      return [
        {
          artifactError: {
            lockFile: lockFileName,
            stderr: output,
          },
        },
      ];
    }
    if (
      (err.stdout &&
        err.stdout.includes('Please supply credentials for this source')) ||
      (err.stderr && err.stderr.includes('Authentication is required')) ||
      (err.stderr &&
        err.stderr.includes(
          'Please make sure you have the correct access rights'
        ))
    ) {
      logger.info(
        { err },
        'Gemfile.lock update failed due to missing credentials - skipping branch'
      );
      // Do not generate these PRs because we don't yet support Bundler authentication
      global.repoCache.bundlerArtifactsError = BUNDLER_INVALID_CREDENTIALS;
      throw new Error(BUNDLER_INVALID_CREDENTIALS);
    }
    const resolveMatchRe = new RegExp('\\s+(.*) was resolved to', 'g');
    if (output.match(resolveMatchRe)) {
      logger.debug({ err }, 'Bundler has a resolve error');
      const resolveMatches = [];
      let resolveMatch;
      do {
        resolveMatch = resolveMatchRe.exec(output);
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
        return updateArtifacts({
          packageFileName,
          updatedDeps: newUpdatedDeps,
          newPackageFileContent,
          config,
        });
      }
      logger.info(
        { err },
        'Gemfile.lock update failed due to incompatible packages'
      );
      return [
        {
          artifactError: {
            lockFile: lockFileName,
            stderr: err.stdout + '\n' + err.stderr,
          },
        },
      ];
    }
    logger.warn(
      { err },
      'Gemfile.lock update failed due to unknown reason - skipping branch'
    );
    global.repoCache.bundlerArtifactsError = BUNDLER_UNKNOWN_ERROR;
    throw new Error(BUNDLER_UNKNOWN_ERROR);
  }
}
