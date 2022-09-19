import is from '@sindresorhus/is';
import semver from 'semver';
import { quote } from 'shlex';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import {
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
} from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { ExternalHostError } from '../../../../types/errors/external-host-error';
import { exec } from '../../../../util/exec';
import type {
  ExecOptions,
  ExtraEnv,
  ToolConstraint,
} from '../../../../util/exec/types';
import {
  localPathIsFile,
  readLocalFile,
  writeLocalFile,
} from '../../../../util/fs';
import { newlineRegex, regEx } from '../../../../util/regex';
import { uniqueStrings } from '../../../../util/string';
import { NpmDatasource } from '../../../datasource/npm';
import type { PostUpdateConfig, Upgrade } from '../../types';
import type { NpmManagerData } from '../types';
import { getNodeToolConstraint } from './node-version';
import type { GenerateLockFileResult } from './types';

export async function checkYarnrc(
  lockFileDir: string
): Promise<{ offlineMirror: boolean; yarnPath: string | null }> {
  let offlineMirror = false;
  let yarnPath: string | null = null;
  try {
    const yarnrc = await readLocalFile(
      upath.join(lockFileDir, '.yarnrc'),
      'utf8'
    );
    if (is.string(yarnrc)) {
      const mirrorLine = yarnrc
        .split(newlineRegex)
        .find((line) => line.startsWith('yarn-offline-mirror '));
      offlineMirror = !!mirrorLine;
      const pathLine = yarnrc
        .split(newlineRegex)
        .find((line) => line.startsWith('yarn-path '));
      if (pathLine) {
        yarnPath = pathLine.replace(regEx(/^yarn-path\s+"?(.+?)"?$/), '$1');
      }
      if (yarnPath) {
        // resolve binary relative to `yarnrc`
        yarnPath = upath.join(lockFileDir, yarnPath);
      }
      const yarnBinaryExists = yarnPath
        ? await localPathIsFile(yarnPath)
        : false;
      if (!yarnBinaryExists) {
        const scrubbedYarnrc = yarnrc.replace(
          regEx(/^yarn-path\s+"?.+?"?$/gm),
          ''
        );
        await writeLocalFile(
          upath.join(lockFileDir, '.yarnrc'),
          scrubbedYarnrc
        );
        yarnPath = null;
      }
    }
  } catch (err) /* istanbul ignore next */ {
    // not found
  }
  return { offlineMirror, yarnPath };
}

export function getOptimizeCommand(fileName: string): string {
  return `sed -i 's/ steps,/ steps.slice(0,1),/' ${quote(fileName)}`;
}

export function isYarnUpdate(upgrade: Upgrade): boolean {
  return upgrade.depType === 'packageManager' && upgrade.depName === 'yarn';
}

export async function generateLockFile(
  lockFileDir: string,
  env: NodeJS.ProcessEnv,
  config: Partial<PostUpdateConfig<NpmManagerData>> = {},
  upgrades: Upgrade[] = []
): Promise<GenerateLockFileResult> {
  const lockFileName = upath.join(lockFileDir, 'yarn.lock');
  logger.debug(`Spawning yarn install to create ${lockFileName}`);
  let lockFile: string | null = null;
  try {
    const toolConstraints: ToolConstraint[] = [
      await getNodeToolConstraint(config, upgrades),
    ];
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

    const yarnTool: ToolConstraint = {
      toolName: 'yarn',
      constraint: '^1.22.18', // needs to be a v1 yarn, otherwise v2 will be installed
    };

    // check first upgrade, see #17786
    const hasPackageManager =
      !!config.managerData?.hasPackageManager ||
      !!upgrades[0]?.managerData?.hasPackageManager;

    if (!isYarn1 && hasPackageManager) {
      toolConstraints.push({ toolName: 'corepack' });
    } else {
      toolConstraints.push(yarnTool);
      if (isYarn1 && minYarnVersion) {
        yarnTool.constraint = yarnCompatibility;
      }
    }

    const extraEnv: ExtraEnv = {
      NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
      npm_config_store: env.npm_config_store,
      CI: 'true',
    };

    const commands: string[] = [];
    let cmdOptions = ''; // should have a leading space
    if (config.skipInstalls !== false) {
      if (isYarn1) {
        const { offlineMirror, yarnPath } = await checkYarnrc(lockFileDir);
        if (!offlineMirror) {
          logger.debug('Updating yarn.lock only - skipping node_modules');
          // The following change causes Yarn 1.x to exit gracefully after updating the lock file but without installing node_modules
          yarnTool.toolName = 'yarn-slim';
          if (yarnPath) {
            commands.push(getOptimizeCommand(yarnPath) + ' || true');
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

    const execOptions: ExecOptions = {
      cwdFile: lockFileName,
      extraEnv,
      docker: {
        image: 'sidecar',
      },
      toolConstraints,
    };
    // istanbul ignore if
    if (GlobalConfig.get('exposeAllEnv')) {
      extraEnv.NPM_AUTH = env.NPM_AUTH;
      extraEnv.NPM_EMAIL = env.NPM_EMAIL;
    }

    if (yarnUpdate && !isYarn1) {
      logger.debug('Updating Yarn binary');
      // TODO: types (#7154)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
            .filter(is.string)
            .filter(uniqueStrings)
            .join(' ')}${cmdOptions}`
        );
      } else {
        // `yarn up` updates to the latest release, so the range should be specified
        commands.push(
          `yarn up ${lockUpdates
            // TODO: types (#7154)
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            .map((update) => `${update.depName}@${update.newValue}`)
            .filter(uniqueStrings)
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

      // Note: Instead of just deleting the `yarn.lock` file, we just wipe it
      // and keep an empty lock file. Deleting the lock file could result in different
      // Yarn semantics. e.g. Yarn 2+ will error when `yarn install` is executed in
      // a subdirectory which is not part of a Yarn workspace. Yarn suggests to create
      // an empty lock file if a subdirectory should be treated as its own workspace.
      // https://github.com/yarnpkg/berry/blob/20612e82d26ead5928cc27bf482bb8d62dde87d3/packages/yarnpkg-core/sources/Project.ts#L284.
      try {
        await writeLocalFile(lockFileName, '');
      } catch (err) /* istanbul ignore next */ {
        logger.debug(
          { err, lockFileName },
          'Error clearing `yarn.lock` for lock file maintenance'
        );
      }
    }

    // Run the commands
    await exec(commands, execOptions);

    // Read the result
    lockFile = await readLocalFile(lockFileName, 'utf8');
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
    const stdouterr = String(err.stdout) + String(err.stderr);
    if (
      stdouterr.includes('ENOSPC: no space left on device') ||
      stdouterr.includes('Out of diskspace')
    ) {
      throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
    }
    if (
      stdouterr.includes('The registry may be down.') ||
      stdouterr.includes('getaddrinfo ENOTFOUND registry.yarnpkg.com') ||
      stdouterr.includes('getaddrinfo ENOTFOUND registry.npmjs.org')
    ) {
      throw new ExternalHostError(err, NpmDatasource.id);
    }
    return { error: true, stderr: err.stderr, stdout: err.stdout };
  }
  return { lockFile };
}
