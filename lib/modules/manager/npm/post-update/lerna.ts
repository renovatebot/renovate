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
import type { PackageFile, PostUpdateConfig } from '../../types';
import { getNodeToolConstraint } from './node-version';
import type { GenerateLockFileResult } from './types';

// Exported for testability
export function getLernaVersion(
  lernaPackageFile: Partial<PackageFile>
): string | null {
  const lernaDep = lernaPackageFile.deps?.find((d) => d.depName === 'lerna');
  if (!lernaDep?.currentValue || !semver.validRange(lernaDep.currentValue)) {
    logger.warn(
      // TODO: types (#7154)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `Could not detect lerna version in ${lernaPackageFile.packageFile}, using 'latest'`
    );
    return null;
  }
  return lernaDep.currentValue;
}

export async function generateLockFiles(
  lernaPackageFile: Partial<PackageFile>,
  lockFileDir: string,
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
  const toolConstraints: ToolConstraint[] = [
    await getNodeToolConstraint(config, []),
  ];
  const cmd: string[] = [];
  let cmdOptions = '';
  try {
    if (lernaClient === 'yarn') {
      const yarnTool: ToolConstraint = {
        toolName: 'yarn',
        constraint: '^1.22.18', // needs to be a v1 yarn, otherwise v2 will be installed
      };
      const yarnCompatibility = config.constraints?.yarn;
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
      const npmCompatibility = config.constraints?.npm;
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
    if (GlobalConfig.get('allowScripts') && config.ignoreScripts !== false) {
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
    const lernaVersion = getLernaVersion(lernaPackageFile);
    logger.debug(`Using lerna version ${lernaVersion ?? 'latest'}`);
    toolConstraints.push({ toolName: 'lerna', constraint: lernaVersion });
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
