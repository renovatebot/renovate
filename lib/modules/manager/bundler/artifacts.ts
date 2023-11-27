import { lt } from '@renovatebot/ruby-semver';
import is from '@sindresorhus/is';
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
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import { newlineRegex, regEx } from '../../../util/regex';
import { isValid } from '../../versioning/ruby';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import {
  getBundlerConstraint,
  getLockFilePath,
  getRubyConstraint,
} from './common';
import {
  findAllAuthenticatable,
  getAuthenticationHeaderValue,
} from './host-rules';

const hostConfigVariablePrefix = 'BUNDLE_';

function buildBundleHostVariable(hostRule: HostRule): Record<string, string> {
  if (!hostRule.resolvedHost || hostRule.resolvedHost.includes('-')) {
    return {};
  }
  const varName = hostConfigVariablePrefix.concat(
    hostRule.resolvedHost
      .split('.')
      .map((term) => term.toUpperCase())
      .join('__'),
  );
  return {
    [varName]: `${getAuthenticationHeaderValue(hostRule)}`,
  };
}

const resolvedPkgRegex = regEx(
  /(?<pkg>\S+)(?:\s*\([^)]+\)\s*)? was resolved to/,
);

function getResolvedPackages(input: string): string[] {
  const lines = input.split(newlineRegex);
  const result: string[] = [];
  for (const line of lines) {
    const resolveMatchGroups = line.match(resolvedPkgRegex)?.groups;
    if (resolveMatchGroups) {
      const { pkg } = resolveMatchGroups;
      result.push(pkg);
    }
  }

  return [...new Set(result)];
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
  recursionLimit = 10,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName, updatedDeps, newPackageFileContent, config } =
    updateArtifact;
  logger.debug(`bundler.updateArtifacts(${packageFileName})`);
  const existingError = memCache.get<string>('bundlerArtifactsError');
  // istanbul ignore if
  if (existingError) {
    logger.debug('Aborting Bundler artifacts due to previous failed attempt');
    throw new Error(existingError);
  }
  const lockFileName = await getLockFilePath(packageFileName);
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No Gemfile.lock found');
    return null;
  }

  const updatedDepNames = updatedDeps
    .map(({ depName }) => depName)
    .filter(is.nonEmptyStringAndNotWhitespace);

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    const commands: string[] = [];

    if (config.isLockFileMaintenance) {
      commands.push('bundler lock --update');
    } else {
      const updateTypes = {
        patch: '--patch --strict ',
        minor: '--minor --strict ',
        major: '',
      };
      for (const [updateType, updateArg] of Object.entries(updateTypes)) {
        const deps = updatedDeps
          .filter((dep) => (dep.updateType ?? 'major') === updateType)
          .map((dep) => dep.depName)
          .filter(is.string)
          .filter((dep) => dep !== 'ruby');
        let additionalArgs = '';
        if (config.postUpdateOptions?.includes('bundlerConservative')) {
          additionalArgs = '--conservative ';
        }
        if (deps.length) {
          let cmd = `bundler lock ${updateArg}${additionalArgs}--update ${deps
            .map(quote)
            .join(' ')}`;
          if (cmd.includes(' --conservative ')) {
            cmd = cmd.replace(' --strict', '');
          }
          commands.push(cmd);
        }
      }
    }

    const bundlerHostRules = findAllAuthenticatable({
      hostType: 'rubygems',
    });

    const bundlerHostRulesVariables = bundlerHostRules.reduce(
      (variables, hostRule) => ({
        ...variables,
        ...buildBundleHostVariable(hostRule),
      }),
      {} as Record<string, string>,
    );

    // Detect hosts with a hyphen '-' in the url.
    // Those cannot be added with environment variables but need to be added
    // with the bundler config
    const bundlerHostRulesAuthCommands: string[] = bundlerHostRules.reduce(
      (authCommands: string[], hostRule) => {
        if (hostRule.resolvedHost?.includes('-')) {
          // TODO: fix me, hostrules can missing all auth
          const creds = getAuthenticationHeaderValue(hostRule);
          authCommands.push(`${hostRule.resolvedHost} ${creds}`);
        }
        return authCommands;
      },
      [],
    );

    const bundler = getBundlerConstraint(
      updateArtifact,
      existingLockFileContent,
    );
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
          (authCommand) => `bundler config --local ${authCommand}`,
        ),
      );
    } else if (bundlerHostRulesAuthCommands) {
      preCommands.push(
        ...bundlerHostRulesAuthCommands.map(
          (authCommand) => `bundler config set --local ${authCommand}`,
        ),
      );
    }

    const execOptions: ExecOptions = {
      cwdFile: lockFileName,
      extraEnv: {
        ...bundlerHostRulesVariables,
        GEM_HOME: await ensureCacheDir('bundler'),
      },
      docker: {},
      toolConstraints: [
        {
          toolName: 'ruby',
          constraint: await getRubyConstraint(updateArtifact),
        },
        {
          toolName: 'bundler',
          constraint: bundler,
        },
      ],
      preCommands,
    };
    await exec(commands, execOptions);

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
  } catch (err) {
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
        'Please make sure you have the correct access rights',
      )
    ) {
      logger.debug(
        { err },
        'Gemfile.lock update failed due to missing credentials - skipping branch',
      );
      // Do not generate these PRs because we don't yet support Bundler authentication
      memCache.set('bundlerArtifactsError', BUNDLER_INVALID_CREDENTIALS);
      throw new Error(BUNDLER_INVALID_CREDENTIALS);
    }
    const resolveMatches: string[] = getResolvedPackages(output).filter(
      (depName) => !updatedDepNames.includes(depName),
    );
    if (
      recursionLimit > 0 &&
      resolveMatches.length &&
      !config.isLockFileMaintenance
    ) {
      logger.debug(
        { resolveMatches, updatedDeps },
        'Found new resolve matches - reattempting recursively',
      );
      const newUpdatedDeps = [
        ...new Set([
          ...updatedDeps,
          ...resolveMatches.map((match) => ({ depName: match })),
        ]),
      ];
      return updateArtifacts(
        {
          packageFileName,
          updatedDeps: newUpdatedDeps,
          newPackageFileContent,
          config,
        },
        recursionLimit - 1,
      );
    }

    logger.info({ err }, 'Gemfile.lock update failed due to an unknown reason');
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
