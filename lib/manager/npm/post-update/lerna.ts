import { exec } from '../../../util/exec';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { PostUpdateConfig } from '../../common';

export interface GenerateLockFileResult {
  error?: boolean;
  stderr?: string;
}

export async function generateLockFiles(
  lernaClient: string,
  cwd: string,
  config: PostUpdateConfig,
  env?: NodeJS.ProcessEnv,
  skipInstalls?: boolean
): Promise<GenerateLockFileResult> {
  if (!lernaClient) {
    logger.warn('No lernaClient specified - returning');
    return { error: false };
  }
  logger.debug(`Spawning lerna with ${lernaClient} to create lock files`);
  const cmd: string[] = [];
  // const envVars = ['NPM_CONFIG_CACHE', 'npm_config_store'];
  try {
    let lernaVersion: string;
    // const volumes: VolumeOption[] = [];
    try {
      const pJson = JSON.parse(await platform.getFile('package.json'));
      lernaVersion =
        (pJson.dependencies && pJson.dependencies.lerna) ||
        (pJson.devDependencies && pJson.devDependencies.lerna);
    } catch (err) {
      logger.warn('Could not detect lerna version in package.json');
    }
    lernaVersion = lernaVersion || 'latest';
    logger.debug('Using lerna version ' + lernaVersion);
    let params: string;
    if (lernaClient === 'npm') {
      if (skipInstalls === false) {
        params = '--ignore-scripts  --no-audit';
      } else {
        params = '--package-lock-only --no-audit';
      }
    } else {
      params =
        '--ignore-scripts --ignore-engines --ignore-platform --mutex network:31879';
    }

    // // istanbul ignore if
    // if (config.dockerMapDotfiles) {
    //   const homeDir =
    //     process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
    //   const homeNpmrc = join(homeDir, '.npmrc');
    //   volumes.push([homeNpmrc, `/home/ubuntu/.npmrc`]);
    // }
    cmd.push(`${lernaClient} install ${params}`);
    cmd.push(`npx lerna@${lernaVersion} bootstrap --no-ci -- ${params}`);
    await exec(cmd, {
      cwd,
      env,
      // docker: {
      //   image: `renovate/${lernaClient}`,
      //   volumes,
      //   envVars,
      // },
    });
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
