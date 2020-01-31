import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import { exec, ExecOptions } from '../../util/exec';
import { logger } from '../../logger';
import { isValid } from '../../versioning/ruby';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';
import { platform } from '../../platform';
import {
  BUNDLER_INVALID_CREDENTIALS,
  BUNDLER_UNKNOWN_ERROR,
} from '../../constants/error-messages';
import { HostRule } from '../../util/host-rules';
import {
  getAuthenticationHeaderValue,
  findAllAuthenticatable,
  getDomain,
} from './host-rules';

const hostConfigVariablePrefix = 'BUNDLE_';

async function getRubyConstraint(
  updateArtifact: UpdateArtifact
): Promise<string> {
  const { packageFileName, config } = updateArtifact;
  const { compatibility = {} } = config;
  const { ruby } = compatibility;

  let rubyConstraint: string;
  if (ruby) {
    logger.debug('Using rubyConstraint from config');
    rubyConstraint = ruby;
  } else {
    const rubyVersionFile = getSiblingFileName(
      packageFileName,
      '.ruby-version'
    );
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

function buildBundleHostVariable(hostRule: HostRule): Record<string, string> {
  const varName =
    hostConfigVariablePrefix +
    getDomain(hostRule)
      .split('.')
      .map(term => term.toUpperCase())
      .join('__');

  return {
    [varName]: `${getAuthenticationHeaderValue(hostRule)}`,
  };
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
  const lockFileName = `${packageFileName}.lock`;
  const existingLockFileContent = await platform.getFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No Gemfile.lock found');
    return null;
  }
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    const cmd = `bundle lock --update ${updatedDeps.join(' ')}`;

    let bundlerVersion = '';
    const { bundler } = compatibility;
    if (bundler) {
      if (isValid(bundler)) {
        logger.debug({ bundlerVersion: bundler }, 'Found bundler version');
        bundlerVersion = ` -v ${bundler}`;
      } else {
        logger.warn({ bundlerVersion: bundler }, 'Invalid bundler version');
      }
    } else {
      logger.debug('No bundler version constraint found - will use latest');
    }
    const preCommands = [
      'ruby --version',
      `gem install bundler${bundlerVersion} --no-document`,
    ];

    const bundlerHostRulesVariables = findAllAuthenticatable({
      hostType: 'bundler',
    }).reduce((variables, hostRule) => {
      return { ...variables, ...buildBundleHostVariable(hostRule) };
    }, {} as Record<string, string>);

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      extraEnv: bundlerHostRulesVariables,
      docker: {
        image: 'renovate/ruby',
        tagScheme: 'ruby',
        tagConstraint: await getRubyConstraint(updateArtifact),
        preCommands,
      },
    };
    await exec(cmd, execOptions);
    const status = await platform.getRepoStatus();
    if (!status.modified.includes(lockFileName)) {
      return null;
    }
    logger.debug('Returning updated Gemfile.lock');
    const lockFileContent = await readLocalFile(lockFileName);
    return [
      {
        file: {
          name: lockFileName,
          contents: lockFileContent,
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
