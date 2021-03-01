import semver, { validRange } from 'semver';
import { quote } from 'shlex';
import { join } from 'upath';
import { getAdminConfig } from '../../../config/admin';
import { logger } from '../../../logger';
import { ExecOptions, exec } from '../../../util/exec';
import { PackageFile, PostUpdateConfig } from '../../common';
import { getNodeConstraint } from './node-version';
import { optimizeCommand } from './yarn';

export interface GenerateLockFileResult {
  error?: boolean;
  stderr?: string;
}

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
      const npmCompatibility = config.constraints?.npm;
      if (validRange(npmCompatibility)) {
        installNpm += `@${quote(npmCompatibility)}`;
        preCommands.push(installNpm, 'hash -d npm');
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
    if (
      getAdminConfig().trustLevel === 'high' &&
      config.ignoreScripts !== false
    ) {
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
    // istanbul ignore if
    if (getAdminConfig().trustLevel === 'high') {
      execOptions.extraEnv.NPM_AUTH = env.NPM_AUTH;
      execOptions.extraEnv.NPM_EMAIL = env.NPM_EMAIL;
      execOptions.extraEnv.NPM_TOKEN = env.NPM_TOKEN;
    }
    if (config.dockerMapDotfiles) {
      const homeDir =
        process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
      const homeNpmrc = join(homeDir, '.npmrc');
      execOptions.docker.volumes = [[homeNpmrc, '/home/ubuntu/.npmrc']];
    }
    cmd.push(`${lernaClient} install ${cmdOptions}`);
    const lernaVersion = getLernaVersion(lernaPackageFile);
    logger.debug('Using lerna version ' + lernaVersion);
    preCommands.push(`npm i -g lerna@${quote(lernaVersion)}`);
    cmd.push(lernaCommand);
    await exec(cmd, execOptions);
  } catch (err) /* c8 ignore next */ {
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
