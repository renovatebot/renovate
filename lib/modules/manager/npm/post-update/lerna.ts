import is from '@sindresorhus/is';
import semver from 'semver';
import upath from 'upath';
import { GlobalConfig } from '../../../../config/global';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import { exec } from '../../../../util/exec';
import type {
  ExecOptions,
  ExtraEnv,
  ToolConstraint,
} from '../../../../util/exec/types';
import type {
  PackageFile,
  PackageFileContent,
  PostUpdateConfig,
} from '../../types';
import type { PackageJsonSchema } from '../schema';
import type { NpmManagerData } from '../types';
import { getNodeToolConstraint } from './node-version';
import type { GenerateLockFileResult } from './types';
import { getPackageManagerVersion, lazyLoadPackageJson } from './utils';

// Exported for testability
export function getLernaVersion(
  lernaPackageFile: Partial<PackageFile<NpmManagerData>>,
  lazyPgkJson: PackageJsonSchema
): string | null {
  const constraint = getPackageManagerVersion('lerna', lazyPgkJson);
  if (!constraint || !semver.validRange(constraint)) {
    logger.warn(
      // TODO: types (#7154)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Could not detect lerna version in ${lernaPackageFile.packageFile}, using 'latest'`
    );
    return null;
  }
  return constraint;
}

export async function generateLockFiles(
  lernaPackageFile: Partial<PackageFileContent<NpmManagerData>>,
  lockFileDir: string,
  config: PostUpdateConfig,
  env: NodeJS.ProcessEnv,
  skipInstalls?: boolean | null
): Promise<GenerateLockFileResult> {
  const lernaClient = lernaPackageFile.managerData?.lernaClient;
  if (!is.nonEmptyString(lernaClient)) {
    logger.warn('No lernaClient specified - returning');
    return { error: false };
  }
  logger.debug(`Spawning lerna with ${lernaClient} to create lock files`);

  const cmd: string[] = [];
  let cmdOptions = '';
  try {
    const lazyPgkJson = lazyLoadPackageJson(lockFileDir);
    const toolConstraints: ToolConstraint[] = [
      await getNodeToolConstraint(config, [], lockFileDir, lazyPgkJson),
    ];
    if (lernaClient === 'yarn') {
      const yarnTool: ToolConstraint = {
        toolName: 'yarn',
        constraint: '^1.22.18', // needs to be a v1 yarn, otherwise v2 will be installed
      };
      const yarnCompatibility =
        config.constraints?.yarn ??
        getPackageManagerVersion('yarn', await lazyPgkJson.getValue());
      if (semver.validRange(yarnCompatibility)) {
        yarnTool.constraint = yarnCompatibility;
      }
      toolConstraints.push(yarnTool);
      if (skipInstalls !== false) {
        // The following change causes Yarn 1.x to exit gracefully after updating the lock file but without installing node_modules
        yarnTool.toolName = 'yarn-slim';
      }
      cmdOptions = '--ignore-scripts --ignore-engines --ignore-platform';
    } else if (lernaClient === 'npm') {
      const npmTool: ToolConstraint = { toolName: 'npm' };
      const npmCompatibility =
        config.constraints?.npm ??
        getPackageManagerVersion('npm', await lazyPgkJson.getValue());
      if (semver.validRange(npmCompatibility)) {
        npmTool.constraint = npmCompatibility;
      }
      toolConstraints.push(npmTool);
      cmdOptions = '--ignore-scripts  --no-audit';
      if (skipInstalls !== false) {
        cmdOptions += ' --package-lock-only';
      }
    } else {
      logger.warn({ lernaClient }, 'Unknown lernaClient');
      return { error: false };
    }
    let lernaCommand = `lerna bootstrap --no-ci --ignore-scripts -- `;
    if (GlobalConfig.get('allowScripts') && !config.ignoreScripts) {
      cmdOptions = cmdOptions.replace('--ignore-scripts ', '');
      lernaCommand = lernaCommand.replace('--ignore-scripts ', '');
    }
    lernaCommand += cmdOptions;
    const extraEnv: ExtraEnv = {
      NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
      npm_config_store: env.npm_config_store,
    };
    const execOptions: ExecOptions = {
      cwdFile: upath.join(lockFileDir, 'package.json'),
      extraEnv,
      docker: {},
      toolConstraints,
    };
    // istanbul ignore if
    if (GlobalConfig.get('exposeAllEnv')) {
      extraEnv.NPM_AUTH = env.NPM_AUTH;
      extraEnv.NPM_EMAIL = env.NPM_EMAIL;
    }
    const lernaVersion =
      config.constraints?.lerna ??
      getLernaVersion(lernaPackageFile, await lazyPgkJson.getValue());
    if (
      !is.string(lernaVersion) ||
      (semver.valid(lernaVersion) && semver.gte(lernaVersion, '7.0.0'))
    ) {
      logger.debug('Skipping lerna bootstrap');
      cmd.push(`${lernaClient} install ${cmdOptions}`);
    } else {
      logger.debug(`Using lerna version ${lernaVersion}`);
      toolConstraints.push({ toolName: 'lerna', constraint: lernaVersion });
      cmd.push('lerna info || echo "Ignoring lerna info failure"');
      cmd.push(`${lernaClient} install ${cmdOptions}`);
      cmd.push(lernaCommand);
    }
    await exec(cmd, execOptions);
  } catch (err) /* istanbul ignore next */ {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug(
      {
        cmd,
        err,
        type: 'lerna',
        lernaClient,
      },
      'lock file error'
    );
    return { error: true, stderr: err.stderr };
  }
  return { error: false };
}
