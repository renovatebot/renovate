import { isNonEmptyStringAndNotWhitespace, isString } from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { findGithubToken } from '../../../util/check-token.ts';
import { exec } from '../../../util/exec/index.ts';
import type {
  ConstraintName,
  ExecOptions,
  ExtraEnv,
  ToolConstraint,
} from '../../../util/exec/types.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { api as miseVersioning } from '../../versioning/semver/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { getConfigType, getLockFileName } from './lockfile.ts';

/**
 * First mise release whose `MISE_SAFE=1` safe mode is a hard boundary against
 * project configuration executing code during `mise lock`.
 *
 * Safe mode (jdx/mise#11146) and lockfile bumping (jdx/mise#11145) merged after
 * v2026.7.11, so the first release to include them is expected to be 2026.7.12.
 * TODO(mise-safe): confirm this once that release is tagged.
 *
 * @see https://github.com/jdx/mise/pull/11146
 * @see https://mise.jdx.dev/configuration/settings.html#safe
 */
const MISE_SAFE_MODE_MIN_VERSION = '2026.7.12';

/**
 * Returns true when the configured `mise` constraint *guarantees* a version
 * that enforces safe mode, so `mise lock` can run against untrusted config
 * without requiring `allowedUnsafeExecutions`.
 *
 * Because this gates a security bypass, the check is deliberately conservative:
 * it accepts only a single pinned version (`mise = "2026.7.12"`) at or above the
 * safe-mode release. Ranges such as `>=2026.7.12` are safe in principle but are
 * intentionally not accepted yet — supporting them (and/or runtime detection
 * via `mise version`) is left for follow-up; see the PR discussion.
 */
function miseSupportsSafeMode(
  constraints?: Partial<Record<ConstraintName, string>> | null,
): boolean {
  const constraint = constraints?.mise;
  if (!isString(constraint) || !miseVersioning.isVersion(constraint)) {
    return false;
  }
  return (
    miseVersioning.equals(constraint, MISE_SAFE_MODE_MIN_VERSION) ||
    miseVersioning.isGreaterThan(constraint, MISE_SAFE_MODE_MIN_VERSION)
  );
}

/**
 * Resolver tools that mise may invoke while running `mise lock`, for instance to convert an inexact version like `1` against the npm registry.
 *
 * NOTE: this will install all relevant tools, regardless of what the given mise configuration uses.
 *
 * In safe mode these are unnecessary: npm version listing uses mise's built-in
 * registry HTTP client and go runs with `GOTOOLCHAIN=local`, so `mise lock`
 * resolves versions over HTTP without shelling out to node/npm/ruby.
 *
 * @see https://mise.jdx.dev/dev-tools/backends/npm.html
 * @see https://mise.jdx.dev/dev-tools/backends/go.html
 * @see https://mise.jdx.dev/dev-tools/backends/gem.html
 */
function getMiseLockToolConstraints(
  constraints?: Partial<Record<ConstraintName, string>> | null,
  safeMode = false,
): ToolConstraint[] {
  const miseConstraint: ToolConstraint = {
    toolName: 'mise',
    constraint: constraints?.mise,
  };
  if (safeMode) {
    return [miseConstraint];
  }
  return [
    miseConstraint,
    { toolName: 'node', constraint: constraints?.node },
    { toolName: 'npm', constraint: constraints?.npm },
    { toolName: 'golang', constraint: constraints?.go },
    { toolName: 'ruby', constraint: constraints?.ruby },
  ];
}

/**
 * Updates mise lock files when dependencies are updated.
 * Runs `mise lock` for lock file maintenance or `mise lock <tools>` for targeted updates.
 */
export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const lockFileName = getLockFileName(packageFileName);
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug({ lockFileName }, 'No mise lock file found');
    return null;
  }

  // `mise lock` normally executes the project's mise config, so it requires
  // `allowedUnsafeExecutions`. When the configured mise version guarantees safe
  // mode, we instead run with `MISE_SAFE=1`, which is a hard boundary against
  // the config executing code — so the allowlist is not required on that path.
  const allowlist = GlobalConfig.get('allowedUnsafeExecutions');
  const miseAllowlisted = allowlist.includes('mise');
  const safeMode = !miseAllowlisted && miseSupportsSafeMode(config.constraints);
  if (!miseAllowlisted && !safeMode) {
    logger.once.warn(
      { safeModeMinVersion: MISE_SAFE_MODE_MIN_VERSION },
      '`mise lock` was requested to run, but `mise` is not permitted in `allowedUnsafeExecutions` and no `mise` constraint guaranteeing safe-mode support is configured',
    );
    return null;
  }

  const { isLocal, env } = getConfigType(packageFileName);
  const localFlag = isLocal ? ' --local' : '';

  let lockCmd: string;
  if (config.isLockFileMaintenance) {
    lockCmd = `mise lock${localFlag}`;
  } else {
    const tools = updatedDeps
      .map(({ depName }) => depName)
      .filter(isNonEmptyStringAndNotWhitespace)
      .map(quote)
      .join(' ');
    lockCmd = tools
      ? `mise lock${localFlag} ${tools}`
      : `mise lock${localFlag}`;
  }

  const extraEnv: ExtraEnv = {};
  if (env) {
    extraEnv.MISE_ENV = env;
  }
  if (safeMode) {
    extraEnv.MISE_SAFE = '1';
  }
  const token = findGithubToken(
    hostRules.find({
      hostType: 'github',
      url: 'https://api.github.com/',
    }),
  );
  if (token) {
    extraEnv.GITHUB_TOKEN = token;
  }

  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    extraEnv,
    toolConstraints: getMiseLockToolConstraints(config.constraints, safeMode),
    docker: {},
  };

  const trustCmd = `mise trust ${quote(upath.basename(packageFileName))}`;

  try {
    await exec([trustCmd, lockCmd], execOptions);
    const newLockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (!newLockFileContent || existingLockFileContent === newLockFileContent) {
      return null;
    }

    logger.debug({ lockFileName }, 'Returning updated mise lock file');
    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newLockFileContent,
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if: not worth testing
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }

    const errorOutput = [err.stdout, err.stderr, err.message]
      .filter(isString)
      .join('\n');

    logger.warn({ err, lockFileName }, 'Error updating mise lock file');
    return [
      {
        artifactError: {
          fileName: lockFileName,
          stderr: errorOutput,
        },
      },
    ];
  }
}
