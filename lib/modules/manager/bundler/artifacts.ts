import { lt } from '@renovatebot/ruby-semver';
import { quote } from 'shlex';
import {
  BUNDLER_INVALID_CREDENTIALS,
  TEMPORARY_ERROR,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import type { HostRule } from '../../../types';
import * as memCache from '../../../util/cache/memory';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  ensureCacheDir,
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import { regEx } from '../../../util/regex';
import { addSecretForSanitizing } from '../../../util/sanitize';
import { isValid } from '../../versioning/ruby';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import {
  findAllAuthenticatable,
  getAuthenticationHeaderValue,
} from './host-rules';

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
        .replace(regEx(/^ruby-/), '')
        .replace(regEx(/\n/g), '')
        .trim();
    }
  }
  return rubyConstraint;
}

function buildBundleHostVariable(hostRule: HostRule): Record<string, string> {
  if (hostRule.resolvedHost.includes('-')) {
    return {};
  }
  const varName = hostConfigVariablePrefix.concat(
    hostRule.resolvedHost
      .split('.')
      .map((term) => term.toUpperCase())
      .join('__')
  );
  return {
    [varName]: `${getAuthenticationHeaderValue(hostRule)}`,
  };
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;
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

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    let cmd;

    if (config.isLockFileMaintenance) {
      cmd = 'bundler lock --update';
    } else {
      cmd = `bundler lock --update ${updatedDeps
        .map((dep) => dep.depName)
        .map(quote)
        .join(' ')}`;
    }

    const bundlerHostRules = findAllAuthenticatable({
      hostType: 'rubygems',
    });

    const bundlerHostRulesVariables = bundlerHostRules.reduce(
      (variables, hostRule) => ({
        ...variables,
        ...buildBundleHostVariable(hostRule),
      }),
      {} as Record<string, string>
    );

    // Detect hosts with a hyphen '-' in the url.
    // Those cannot be added with environment variables but need to be added
    // with the bundler config
    const bundlerHostRulesAuthCommands: string[] = bundlerHostRules.reduce(
      (authCommands: string[], hostRule) => {
        if (hostRule.resolvedHost.includes('-')) {
          const creds = getAuthenticationHeaderValue(hostRule);
          authCommands.push(`${hostRule.resolvedHost} ${creds}`);
          // sanitize the authentication
          addSecretForSanitizing(creds);
        }
        return authCommands;
      },
      []
    );

    const { bundler } = constraints || {};
    const preCommands = ['ruby --version'];

    // Bundler < 2 has a different config option syntax than >= 2
    if (
      bundlerHostRulesAuthCommands &&
      bundler &&
      isValid(bundler) &&
      lt(bundler, '2')
    ) {
      preCommands.push(
        ...bundlerHostRulesAuthCommands.map(
          (authCommand) => `bundler config --local ${authCommand}`
        )
      );
    } else if (bundlerHostRulesAuthCommands) {
      preCommands.push(
        ...bundlerHostRulesAuthCommands.map(
          (authCommand) => `bundler config set --local ${authCommand}`
        )
      );
    }

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      extraEnv: {
        ...bundlerHostRulesVariables,
        GEM_HOME: await ensureCacheDir('bundler'),
      },
      docker: {
        image: 'ruby',
        tagScheme: 'ruby',
        tagConstraint: await getRubyConstraint(updateArtifact),
      },
      toolConstraints: [
        {
          toolName: 'bundler',
          constraint: bundler,
        },
      ],
      preCommands,
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
          type: 'addition',
          path: lockFileName,
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
    const resolveMatchRe = regEx('\\s+(.*) was resolved to', 'g');
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
