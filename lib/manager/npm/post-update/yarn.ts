import is from '@sindresorhus/is';
import { gte, minVersion, validRange } from 'semver';
import { quote } from 'shlex';
import { join } from 'upath';
import { getAdminConfig } from '../../../config/admin';
import {
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
} from '../../../constants/error-messages';
import { id as npmId } from '../../../datasource/npm';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { ExecOptions, exec } from '../../../util/exec';
import { readFile, remove } from '../../../util/fs';
import type { PostUpdateConfig, Upgrade } from '../../types';
import { getNodeConstraint } from './node-version';

export interface GenerateLockFileResult {
  error?: boolean;
  lockFile?: string;
  stderr?: string;
}

export async function checkYarnrc(
  cwd: string
): Promise<{ offlineMirror: boolean; yarnPath: string | null }> {
  let offlineMirror = false;
  let yarnPath: string = null;
  try {
    const yarnrc = await readFile(`${cwd}/.yarnrc`, 'utf8');
    if (is.string(yarnrc)) {
      const mirrorLine = yarnrc
        .split('\n')
        .find((line) => line.startsWith('yarn-offline-mirror '));
      offlineMirror = !!mirrorLine;
      const pathLine = yarnrc
        .split('\n')
        .find((line) => line.startsWith('yarn-path '));
      if (pathLine) {
        yarnPath = pathLine.replace(/^yarn-path\s+"?(.+?)"?$/, '$1');
      }
    }
  } catch (err) /* istanbul ignore next */ {
    // not found
  }
  return { offlineMirror, yarnPath };
}

export function getOptimizeCommand(
  fileName = '/home/ubuntu/.npm-global/lib/node_modules/yarn/lib/cli.js'
): string {
  return `sed -i 's/ steps,/ steps.slice(0,1),/' ${quote(fileName)}`;
}

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
    const yarnCompatibility = config.constraints?.yarn;
    const minYarnVersion =
      validRange(yarnCompatibility) && minVersion(yarnCompatibility);
    const isYarn1 = !minYarnVersion || minYarnVersion.major === 1;
    const isYarnDedupeAvailable =
      minYarnVersion && gte(minYarnVersion, '2.2.0');

    let installYarn = 'npm i -g yarn';
    if (isYarn1 && minYarnVersion) {
      installYarn += `@${quote(yarnCompatibility)}`;
    }

    const preCommands = [installYarn];

    const extraEnv: ExecOptions['extraEnv'] = {
      NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
      npm_config_store: env.npm_config_store,
      CI: 'true',
    };

    if (isYarn1 && config.skipInstalls !== false) {
      const { offlineMirror, yarnPath } = await checkYarnrc(cwd);
      if (!offlineMirror) {
        logger.debug('Updating yarn.lock only - skipping node_modules');
        // The following change causes Yarn 1.x to exit gracefully after updating the lock file but without installing node_modules
        preCommands.push(getOptimizeCommand());
        if (yarnPath) {
          preCommands.push(getOptimizeCommand(yarnPath) + ' || true');
        }
      }
    }
    const commands = [];
    let cmdOptions = '';
    if (isYarn1) {
      cmdOptions +=
        '--ignore-engines --ignore-platform --network-timeout 100000';
    } else {
      extraEnv.YARN_ENABLE_IMMUTABLE_INSTALLS = 'false';
      extraEnv.YARN_HTTP_TIMEOUT = '100000';
    }
    if (!getAdminConfig().allowScripts || config.ignoreScripts) {
      if (isYarn1) {
        cmdOptions += ' --ignore-scripts';
      } else {
        extraEnv.YARN_ENABLE_SCRIPTS = '0';
      }
    }
    const tagConstraint = await getNodeConstraint(config);
    const execOptions: ExecOptions = {
      cwd,
      extraEnv,
      docker: {
        image: 'node',
        tagScheme: 'npm',
        tagConstraint,
        preCommands,
      },
    };
    // istanbul ignore if
    if (getAdminConfig().exposeAllEnv) {
      execOptions.extraEnv.NPM_AUTH = env.NPM_AUTH;
      execOptions.extraEnv.NPM_EMAIL = env.NPM_EMAIL;
    }

    // This command updates the lock file based on package.json
    commands.push(`yarn install ${cmdOptions}`.trim());

    // rangeStrategy = update-lockfile
    const lockUpdates = upgrades.filter((upgrade) => upgrade.isLockfileUpdate);
    if (lockUpdates.length) {
      logger.debug('Performing lockfileUpdate (yarn)');
      if (isYarn1) {
        // `yarn upgrade` updates based on the version range specified in the package file
        // note - this can hit a yarn bug, see https://github.com/yarnpkg/yarn/issues/8236
        commands.push(
          `yarn upgrade ${lockUpdates
            .map((update) => update.depName)
            .join(' ')} ${cmdOptions}`.trim()
        );
      } else {
        // `yarn up` updates to the latest release, so the range should be specified
        commands.push(
          `yarn up ${lockUpdates
            .map((update) => `${update.depName}@${update.newValue}`)
            .join(' ')}`
        );
      }
    }

    // postUpdateOptions
    if (isYarn1 && config.postUpdateOptions?.includes('yarnDedupeFewer')) {
      logger.debug('Performing yarn dedupe fewer');
      commands.push('npx yarn-deduplicate --strategy fewer');
      // Run yarn again in case any changes are necessary
      commands.push(`yarn install ${cmdOptions}`.trim());
    }
    if (
      (isYarn1 || isYarnDedupeAvailable) &&
      config.postUpdateOptions?.includes('yarnDedupeHighest')
    ) {
      logger.debug('Performing yarn dedupe highest');
      if (isYarn1) {
        commands.push('npx yarn-deduplicate --strategy highest');
        // Run yarn again in case any changes are necessary
        commands.push(`yarn install ${cmdOptions}`.trim());
      } else {
        commands.push('yarn dedupe --strategy highest');
      }
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
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
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
