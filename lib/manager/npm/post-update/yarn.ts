import is from '@sindresorhus/is';
import semver from 'semver';
import { quote } from 'shlex';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import {
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
} from '../../../constants/error-messages';
import { id as npmId } from '../../../datasource/npm';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { exists, readFile, remove, writeFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import type { PostUpdateConfig, Upgrade } from '../../types';
import { getNodeConstraint } from './node-version';
import { GenerateLockFileResult } from './types';

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
        yarnPath = pathLine.replace(regEx(/^yarn-path\s+"?(.+?)"?$/), '$1');
      }
      const yarnBinaryExists = await exists(yarnPath);
      if (!yarnBinaryExists) {
        const scrubbedYarnrc = yarnrc.replace(
          regEx(/^yarn-path\s+"?.+?"?$/gm),
          ''
        );
        await writeFile(`${cwd}/.yarnrc`, scrubbedYarnrc);
        yarnPath = null;
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

export function isYarnUpdate(upgrade: Upgrade): boolean {
  return upgrade.depType === 'packageManager' && upgrade.depName === 'yarn';
}

export async function generateLockFile(
  cwd: string,
  env: NodeJS.ProcessEnv,
  config: PostUpdateConfig = {},
  upgrades: Upgrade[] = []
): Promise<GenerateLockFileResult> {
  const lockFileName = upath.join(cwd, 'yarn.lock');
  logger.debug(`Spawning yarn install to create ${lockFileName}`);
  let lockFile = null;
  try {
    const yarnUpdate = upgrades.find(isYarnUpdate);
    const yarnCompatibility = yarnUpdate
      ? yarnUpdate.newValue
      : config.constraints?.yarn;
    const minYarnVersion =
      semver.validRange(yarnCompatibility) &&
      semver.minVersion(yarnCompatibility);
    const isYarn1 = !minYarnVersion || minYarnVersion.major === 1;
    const isYarnDedupeAvailable =
      minYarnVersion && semver.gte(minYarnVersion, '2.2.0');
    const isYarnModeAvailable =
      minYarnVersion && semver.gte(minYarnVersion, '3.0.0');

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

    const commands = [];
    let cmdOptions = ''; // should have a leading space
    if (config.skipInstalls !== false) {
      if (isYarn1) {
        const { offlineMirror, yarnPath } = await checkYarnrc(cwd);
        if (!offlineMirror) {
          logger.debug('Updating yarn.lock only - skipping node_modules');
          // The following change causes Yarn 1.x to exit gracefully after updating the lock file but without installing node_modules
          preCommands.push(getOptimizeCommand());
          // istanbul ignore if
          if (yarnPath) {
            preCommands.push(getOptimizeCommand(yarnPath) + ' || true');
          }
        }
      } else if (isYarnModeAvailable) {
        // Don't run the link step and only fetch what's necessary to compute an updated lockfile
        cmdOptions += ' --mode=update-lockfile';
      }
    }

    if (isYarn1) {
      cmdOptions +=
        ' --ignore-engines --ignore-platform --network-timeout 100000';
      extraEnv.YARN_CACHE_FOLDER = env.YARN_CACHE_FOLDER;
    } else {
      extraEnv.YARN_ENABLE_IMMUTABLE_INSTALLS = 'false';
      extraEnv.YARN_HTTP_TIMEOUT = '100000';
      extraEnv.YARN_GLOBAL_FOLDER = env.YARN_GLOBAL_FOLDER;
      if (!config.managerData?.yarnZeroInstall) {
        logger.debug('Enabling global cache as zero-install is not detected');
        extraEnv.YARN_ENABLE_GLOBAL_CACHE = '1';
      }
    }
    if (!GlobalConfig.get('allowScripts') || config.ignoreScripts) {
      if (isYarn1) {
        cmdOptions += ' --ignore-scripts';
      } else if (isYarnModeAvailable) {
        if (config.skipInstalls === false) {
          // Don't run the build scripts
          cmdOptions += ' --mode=skip-build';
        }
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
        tagScheme: 'node',
        tagConstraint,
      },
      preCommands,
    };
    // istanbul ignore if
    if (GlobalConfig.get('exposeAllEnv')) {
      execOptions.extraEnv.NPM_AUTH = env.NPM_AUTH;
      execOptions.extraEnv.NPM_EMAIL = env.NPM_EMAIL;
    }

    if (yarnUpdate && !isYarn1) {
      logger.debug('Updating Yarn binary');
      commands.push(`yarn set version ${yarnUpdate.newValue}`);
    }

    // This command updates the lock file based on package.json
    commands.push(`yarn install${cmdOptions}`);

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
            .join(' ')}${cmdOptions}`
        );
      } else {
        // `yarn up` updates to the latest release, so the range should be specified
        commands.push(
          `yarn up ${lockUpdates
            .map((update) => `${update.depName}@${update.newValue}`)
            .join(' ')}${cmdOptions}`
        );
      }
    }

    // postUpdateOptions
    ['fewer', 'highest'].forEach((s) => {
      if (
        config.postUpdateOptions?.includes(
          `yarnDedupe${s.charAt(0).toUpperCase()}${s.slice(1)}`
        )
      ) {
        logger.debug(`Performing yarn dedupe ${s}`);
        if (isYarn1) {
          commands.push(`npx yarn-deduplicate --strategy ${s}`);
          // Run yarn again in case any changes are necessary
          commands.push(`yarn install${cmdOptions}`);
        } else if (isYarnDedupeAvailable && s === 'highest') {
          commands.push(`yarn dedupe --strategy ${s}${cmdOptions}`);
        } else {
          logger.debug(`yarn dedupe ${s} not available`);
        }
      }
    });

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
    return { error: true, stderr: err.stderr, stdout: err.stdout };
  }
  return { lockFile };
}
