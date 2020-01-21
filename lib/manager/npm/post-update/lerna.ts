import { exec } from '../../../util/exec';
import { logger } from '../../../logger';
import { platform } from '../../../platform';
import { BinarySource } from '../../../util/exec/common';

export interface GenerateLockFileResult {
  error?: boolean;
  stderr?: string;
}

export async function generateLockFiles(
  lernaClient: string,
  cwd: string,
  env?: NodeJS.ProcessEnv,
  skipInstalls?: boolean,
  binarySource?: string
): Promise<GenerateLockFileResult> {
  if (!lernaClient) {
    logger.warn('No lernaClient specified - returning');
    return { error: false };
  }
  logger.debug(`Spawning lerna with ${lernaClient} to create lock files`);
  let cmd: string;
  try {
    let lernaVersion: string;
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
    cmd = `npm i -g -C ~/.npm/lerna@${lernaVersion} lerna@${lernaVersion} && ${lernaClient} install ${params} && ~/.npm/lerna@${lernaVersion}/bin/lerna bootstrap --no-ci -- ${params}`;
    if (binarySource === BinarySource.Global) {
      cmd = `${lernaClient} install ${params} && lerna bootstrap --no-ci -- ${params}`;
    }
    await exec(cmd, {
      cwd,
      env,
    });
  } catch (err) /* istanbul ignore next */ {
    logger.info(
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
