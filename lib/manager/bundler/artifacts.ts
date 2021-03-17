import { quote } from 'shlex';
import {
  BUNDLER_INVALID_CREDENTIALS,
  TEMPORARY_ERROR,
} from '../../constants/error-messages';
import { logger } from '../../logger';
import { HostRule } from '../../types';
import * as memCache from '../../util/cache/memory';
import { ExecOptions, exec } from '../../util/exec';
import {
  deleteLocalFile,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import { getRepoStatus } from '../../util/git';
import { isValid } from '../../versioning/ruby';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import {
  findAllAuthenticatable,
  getAuthenticationHeaderValue,
  getDomain,
} from './host-rules';
import { getGemHome } from './utils';

const hostConfigVariablePrefix = 'BUNDLE_';

async function getRubyConstraint(
  updateArtifact: UpdateArtifact
): Promise<string> {
  const { packageFileName, config } = updateArtifact;
  const { constraints = {} } = config;
  const { ruby } = constraints;

  let rubyConstraint: string;
  if (ruby) {
    logger.debug('Using rubyConstraint from config');
    rubyConstraint = ruby;
  } else {
    const rubyVersionFile = getSiblingFileName(
      packageFileName,
      '.ruby-version'
    );
    const rubyVersionFileContent = await readLocalFile(rubyVersionFile, 'utf8');
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
      .map((term) => term.toUpperCase())
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
  const { constraints = {} } = config;
  logger.debug(`bundler.updateArtifacts(${packageFileName})`);
  const existingError = memCache.get<string>('bundlerArtifactsError');
  // istanbul ignore if
  if (existingError) {
    logger.debug('Aborting Bundler artifacts due to previous failed attempt');
    throw new Error(existingError);
  }
  const lockFileName = `${packageFileName}.lock`;
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No Gemfile.lock found');
    return null;
  }

  if (config.isLockFileMaintenance) {
    await deleteLocalFile(lockFileName);
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    let cmd;

    if (config.isLockFileMaintenance) {
      cmd = 'bundle lock';
    } else {
      cmd = `bundle lock --update ${updatedDeps.map(quote).join(' ')}`;
    }

    let bundlerVersion = '';
    const { bundler } = constraints;
    if (bundler) {
      if (isValid(bundler)) {
        logger.debug({ bundlerVersion: bundler }, 'Found bundler version');
        bundlerVersion = ` -v ${quote(bundler)}`;
      } else {
        logger.warn({ bundlerVersion: bundler }, 'Invalid bundler version');
      }
    } else {
      logger.debug('No bundler version constraint found - will use latest');
    }
    const preCommands = [
      'ruby --version',
      `gem install bundler${bundlerVersion}`,
    ];

    const bundlerHostRulesVariables = findAllAuthenticatable({
      hostType: 'bundler',
    }).reduce(
      (variables, hostRule) => ({
        ...variables,
        ...buildBundleHostVariable(hostRule),
      }),
      {} as Record<string, string>
    );

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      extraEnv: {
        ...bundlerHostRulesVariables,
        GEM_HOME: await getGemHome(config),
      },
      docker: {
        image: 'ruby',
        tagScheme: 'ruby',
        tagConstraint: await getRubyConstraint(updateArtifact),
        preCommands,
      },
    };
    await exec(cmd, execOptions);
    const status = await getRepoStatus();
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
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    const output = `${String(err.stdout)}\n${String(err.stderr)}`;
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
      err.stdout?.includes('Please supply credentials for this source') ||
      err.stderr?.includes('Authentication is required') ||
      err.stderr?.includes(
        'Please make sure you have the correct access rights'
      )
    ) {
      logger.debug(
        { err },
        'Gemfile.lock update failed due to missing credentials - skipping branch'
      );
      // Do not generate these PRs because we don't yet support Bundler authentication
      memCache.set('bundlerArtifactsError', BUNDLER_INVALID_CREDENTIALS);
      throw new Error(BUNDLER_INVALID_CREDENTIALS);
    }
    const resolveMatchRe = new RegExp('\\s+(.*) was resolved to', 'g');
    if (output.match(resolveMatchRe) && !config.isLockFileMaintenance) {
      logger.debug({ err }, 'Bundler has a resolve error');
      const resolveMatches = [];
      let resolveMatch;
      do {
        resolveMatch = resolveMatchRe.exec(output);
        if (resolveMatch) {
          resolveMatches.push(resolveMatch[1].split(' ').shift());
        }
      } while (resolveMatch);
      if (resolveMatches.some((match) => !updatedDeps.includes(match))) {
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
      logger.debug(
        { err },
        'Gemfile.lock update failed due to incompatible packages'
      );
    } else {
      logger.info(
        { err },
        'Gemfile.lock update failed due to an unknown reason'
      );
    }
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: `${String(err.stdout)}\n${String(err.stderr)}`,
        },
      },
    ];
  }
}
