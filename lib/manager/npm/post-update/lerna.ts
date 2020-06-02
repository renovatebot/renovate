import semver from 'semver';
import { quote } from 'shlex';
import { join } from 'upath';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { ExecOptions, exec } from '../../../util/exec';
import { PostUpdateConfig } from '../../common';
import { getNodeConstraint } from './node-version';

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
      preCommands.push('npm i -g yarn');
    }
    if (lernaClient === 'npm') {
      if (skipInstalls === false) {
        cmdOptions = '--ignore-scripts  --no-audit';
      } else {
        cmdOptions = '--package-lock-only --no-audit';
      }
    } else {
      cmdOptions = '--ignore-scripts --ignore-engines --ignore-platform';
    }
    if (global.trustLevel === 'high' && config.ignoreScripts !== false) {
      cmdOptions = cmdOptions.replace('--ignore-scripts ', '');
    }
    const tagConstraint = await getNodeConstraint(config.packageFile);
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
    cmd.push(
      `npx lerna@${quote(lernaVersion)} bootstrap --no-ci -- ${cmdOptions}`
    );
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
