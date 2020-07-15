import is from '@sindresorhus/is';
import { validRange } from 'semver';
import { quote } from 'shlex';
import { join } from 'upath';
import { SYSTEM_INSUFFICIENT_DISK_SPACE } from '../../../constants/error-messages';
import { id as npmId } from '../../../datasource/npm';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { ExecOptions, exec } from '../../../util/exec';
import { readFile, remove } from '../../../util/fs';
import { PostUpdateConfig, Upgrade } from '../../common';
import { getNodeConstraint } from './node-version';

export interface GenerateLockFileResult {
  error?: boolean;
  lockFile?: string;
  stderr?: string;
}

export async function hasYarnOfflineMirror(cwd: string): Promise<boolean> {
  try {
    const yarnrc = await readFile(`${cwd}/.yarnrc`, 'utf8');
    if (is.string(yarnrc)) {
      const mirrorLine = yarnrc
        .split('\n')
        .find((line) => line.startsWith('yarn-offline-mirror '));
      if (mirrorLine) {
        return true;
      }
    }
  } catch (err) /* istanbul ignore next */ {
    // not found
  }
  return false;
}

export const optimizeCommand =
  "sed -i 's/ steps,/ steps.slice(0,1),/' /home/ubuntu/.npm-global/lib/node_modules/yarn/lib/cli.js";

export async function generateLockFile(
  cwd: string,
  env: NodeJS.ProcessEnv,
  config: PostUpdateConfig = {},
  upgrades: Upgrade[] = []
): Promise<GenerateLockFileResult> {
  const lockFileName = join(cwd, 'yarn.lock');
  logger.debug(`Spawning yarn install to create ${lockFileName}`);
  let lockFile = null;
  try {
    let installYarn = 'npm i -g yarn';
    const yarnCompatibility = config.compatibility?.yarn;
    if (validRange(yarnCompatibility)) {
      installYarn += `@${quote(yarnCompatibility)}`;
    }
    const preCommands = [installYarn];
    if (
      config.skipInstalls !== false &&
      (await hasYarnOfflineMirror(cwd)) === false
    ) {
      logger.debug('Updating yarn.lock only - skipping node_modules');
      // The following change causes Yarn 1.x to exit gracefully after updating the lock file but without installing node_modules
      preCommands.push(optimizeCommand);
    }
    const commands = [];
    let cmdOptions =
      '--ignore-engines --ignore-platform --network-timeout 100000';
    if (global.trustLevel !== 'high' || config.ignoreScripts) {
      cmdOptions += ' --ignore-scripts';
    }
    const tagConstraint = await getNodeConstraint(config);
    const execOptions: ExecOptions = {
      cwd,
      extraEnv: {
        NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
        npm_config_store: env.npm_config_store,
      },
      docker: {
        image: 'renovate/node',
        tagScheme: 'npm',
        tagConstraint,
        preCommands,
      },
    };
    if (config.dockerMapDotfiles) {
      const homeDir =
        process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
      const homeNpmrc = join(homeDir, '.npmrc');
      execOptions.docker.volumes = [[homeNpmrc, '/home/ubuntu/.npmrc']];
    }

    // This command updates the lock file based on package.json
    commands.push(`yarn install ${cmdOptions}`.trim());

    // rangeStrategy = update-lockfile
    const lockUpdates = upgrades
      .filter((upgrade) => upgrade.isLockfileUpdate)
      .map((upgrade) => [upgrade.depName, upgrade.currentValue].filter(Boolean).join('@'));
    if (lockUpdates.length) {
      logger.debug('Performing lockfileUpdate (yarn)');
      commands.push(
        `yarn upgrade ${lockUpdates.join(' ')} ${cmdOptions}`.trim()
      );
    }

    // postUpdateOptions
    if (config.postUpdateOptions?.includes('yarnDedupeFewer')) {
      logger.debug('Performing yarn dedupe fewer');
      commands.push('npx yarn-deduplicate --strategy fewer');
      // Run yarn again in case any changes are necessary
      commands.push(`yarn install ${cmdOptions}`.trim());
    }
    if (config.postUpdateOptions?.includes('yarnDedupeHighest')) {
      logger.debug('Performing yarn dedupe highest');
      commands.push('npx yarn-deduplicate --strategy highest');
      // Run yarn again in case any changes are necessary
      commands.push(`yarn install ${cmdOptions}`.trim());
    }

    if (upgrades.find((upgrade) => upgrade.isLockFileMaintenance)) {
      logger.debug(
        `Removing ${lockFileName} first due to lock file maintenance upgrade`
      );
      try {
        await remove(lockFileName);
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { err, lockFileName },
          'Error removing yarn.lock for lock file maintenance'
        );
      }
    }

    // Run the commands
    await exec(commands, execOptions);

    // Read the result
    lockFile = await readFile(lockFileName, 'utf8');
  } catch (err) /* istanbul ignore next */ {
    logger.debug(
      {
        err,
        type: 'yarn',
      },
      'lock file error'
    );
    if (err.stderr) {
      if (err.stderr.includes('ENOSPC: no space left on device')) {
        throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
      }
      if (
        err.stderr.includes('The registry may be down.') ||
        err.stderr.includes('getaddrinfo ENOTFOUND registry.yarnpkg.com') ||
        err.stderr.includes('getaddrinfo ENOTFOUND registry.npmjs.org')
      ) {
        throw new ExternalHostError(err, npmId);
      }
    }
    return { error: true, stderr: err.stderr };
  }
  return { lockFile };
}
