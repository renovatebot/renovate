import semver, { validRange } from 'semver';
import { quote } from 'shlex';
import { join } from 'upath';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { ExecOptions, exec } from '../../../util/exec';
import { PostUpdateConfig } from '../../common';
import { getNodeConstraint } from './node-version';
import { optimizeCommand } from './yarn';

export interface GenerateLockFileResult {
  error?: boolean;
  stderr?: string;
}

export async function generateLockFiles(
  lernaClient: string,
  cwd: string,
  config: PostUpdateConfig,
  env: NodeJS.ProcessEnv,
  skipInstalls?: boolean
): Promise<GenerateLockFileResult> {
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
      const yarnCompatibility = config.compatibility?.yarn;
      if (validRange(yarnCompatibility)) {
        installYarn += `@${quote(yarnCompatibility)}`;
      }
      preCommands.push(installYarn);
      if (skipInstalls !== false) {
        preCommands.push(optimizeCommand);
      }
      cmdOptions = '--ignore-scripts --ignore-engines --ignore-platform';
    } else if (lernaClient === 'npm') {
      let installNpm = 'npm i -g npm';
      const npmCompatibility = config.compatibility?.npm;
      if (validRange(npmCompatibility)) {
        installNpm += `@${quote(npmCompatibility)}`;
        preCommands.push(installNpm);
      }
      cmdOptions = '--ignore-scripts  --no-audit';
      if (skipInstalls !== false) {
        cmdOptions += ' --package-lock-only';
      }
    } else {
      logger.warn({ lernaClient }, 'Unknown lernaClient');
      return { error: false };
    }
    let lernaCommand = `lerna bootstrap --no-ci --ignore-scripts -- `;
    if (global.trustLevel === 'high' && config.ignoreScripts !== false) {
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
    cmd.push(`${lernaClient} install ${cmdOptions}`);
    let lernaVersion: string;
    try {
      const pJson = JSON.parse(await platform.getFile('package.json'));
      lernaVersion =
        (pJson.dependencies && pJson.dependencies.lerna) ||
        (pJson.devDependencies && pJson.devDependencies.lerna);
    } catch (err) {
      logger.warn('Could not detect lerna version in package.json');
    }
    if (!lernaVersion || !semver.validRange(lernaVersion)) {
      lernaVersion = 'latest';
    }
    logger.debug('Using lerna version ' + lernaVersion);
    preCommands.push(`npm i -g lerna@${quote(lernaVersion)}`);
    cmd.push(lernaCommand);
    await exec(cmd, execOptions);
  } catch (err) /* istanbul ignore next */ {
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
