import semver, { validRange } from 'semver';
import { quote } from 'shlex';
import { getGlobalConfig } from '../../../config/global';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExecOptions, exec } from '../../../util/exec';
import { getChildProcessEnv } from '../../../util/exec/env';
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
      if (validRange(yarnCompatibility)) {
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
      if (validRange(npmCompatibility)) {
        installNpm += `@${quote(npmCompatibility)} || true`;
      }
      preCommands.push(installNpm, 'hash -d npm');
      cmdOptions = '--ignore-scripts  --no-audit';
      if (skipInstalls !== false) {
        cmdOptions += ' --package-lock-only';
      }
    } else {
      logger.warn({ lernaClient }, 'Unknown lernaClient');
      return { error: false };
    }
    let lernaCommand = `lerna bootstrap --no-ci --ignore-scripts -- `;
    if (getGlobalConfig().allowScripts && config.ignoreScripts !== false) {
      cmdOptions = cmdOptions.replace('--ignore-scripts ', '');
      lernaCommand = lernaCommand.replace('--ignore-scripts ', '');
    }
    lernaCommand += cmdOptions;
    const allowUnstable = true; // lerna will pick the default installed npm@6 unless we use node@>=15

    let extraEnv: ExecOptions['extraEnv'] = {};
    // istanbul ignore if
    if (getGlobalConfig().exposeAllEnv) {
      const { NPM_AUTH, NPM_EMAIL } = getChildProcessEnv();
      extraEnv = { ...extraEnv, NPM_AUTH, NPM_EMAIL };
    }

    const tagConstraint = await getNodeConstraint(config, allowUnstable);
    const execOptions: ExecOptions = {
      cwd,
      extraEnv,
      docker: {
        image: 'node',
        tagScheme: 'npm',
        tagConstraint,
        preCommands,
      },
      cache: {
        NPM_CONFIG_CACHE: 'npm',
        npm_config_store: 'pnpm',
      },
    };

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
