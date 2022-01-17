import semver from 'semver';
import { quote } from 'shlex';
import { GlobalConfig } from '../../../config/global';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import type { PackageFile, PostUpdateConfig } from '../../types';
import { getNodeConstraint } from './node-version';
import type { GenerateLockFileResult } from './types';
import { getOptimizeCommand } from './yarn';

// Exported for testability
export function getLernaVersion(
  lernaPackageFile: Partial<PackageFile>
): string {
  const lernaDep = lernaPackageFile.deps?.find((d) => d.depName === 'lerna');
  if (!lernaDep || !semver.validRange(lernaDep.currentValue)) {
    logger.warn(
      `Could not detect lerna version in ${lernaPackageFile.packageFile}, using 'latest'`
    );
    return 'latest';
  }
  return lernaDep.currentValue;
}

export async function generateLockFiles(
  lernaPackageFile: Partial<PackageFile>,
  cwd: string,
  config: PostUpdateConfig,
  env: NodeJS.ProcessEnv,
  skipInstalls?: boolean
): Promise<GenerateLockFileResult> {
  const lernaClient = lernaPackageFile.lernaClient;
  if (!lernaClient) {
    logger.warn('No lernaClient specified - returning');
    return { error: false };
  }
  logger.debug(`Spawning lerna with ${lernaClient} to create lock files`);
  const preCommands = [];
  const cmd = [];
  let cmdOptions = '';
  try {
    if (lernaClient === 'yarn') {
      let installYarn = 'npm i -g yarn';
      const yarnCompatibility = config.constraints?.yarn;
      if (semver.validRange(yarnCompatibility)) {
        installYarn += `@${quote(yarnCompatibility)}`;
      }
      preCommands.push(installYarn);
      if (skipInstalls !== false) {
        preCommands.push(getOptimizeCommand());
      }
      cmdOptions = '--ignore-scripts --ignore-engines --ignore-platform';
    } else if (lernaClient === 'npm') {
      let installNpm = 'npm i -g npm';
      const npmCompatibility = config.constraints?.npm;
      if (semver.validRange(npmCompatibility)) {
        installNpm += `@${quote(npmCompatibility)} || true`;
      }
      preCommands.push(installNpm, 'hash -d npm 2>/dev/null || true');
      cmdOptions = '--ignore-scripts  --no-audit';
      if (skipInstalls !== false) {
        cmdOptions += ' --package-lock-only';
      }
    } else {
      logger.warn({ lernaClient }, 'Unknown lernaClient');
      return { error: false };
    }
    let lernaCommand = `lerna bootstrap --no-ci --ignore-scripts -- `;
    if (GlobalConfig.get('allowScripts') && config.ignoreScripts !== false) {
      cmdOptions = cmdOptions.replace('--ignore-scripts ', '');
      lernaCommand = lernaCommand.replace('--ignore-scripts ', '');
    }
    lernaCommand += cmdOptions;
    const tagConstraint = await getNodeConstraint(config);
    const execOptions: ExecOptions = {
      cwd,
      extraEnv: {
        NPM_CONFIG_CACHE: env.NPM_CONFIG_CACHE,
        npm_config_store: env.npm_config_store,
      },
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
    const lernaVersion = getLernaVersion(lernaPackageFile);
    logger.debug('Using lerna version ' + lernaVersion);
    preCommands.push(`npm i -g lerna@${quote(lernaVersion)}`);
    cmd.push('lerna info || echo "Ignoring lerna info failure"');
    cmd.push(`${lernaClient} install ${cmdOptions}`);
    cmd.push(lernaCommand);
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
