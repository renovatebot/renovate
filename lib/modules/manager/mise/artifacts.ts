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
import { regEx } from '../../../util/regex.ts';
import { api as miseVersioning } from '../../versioning/semver/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { getConfigType, getLockFileName } from './lockfile.ts';

/**
 * First mise release that supports the features this manager relies on:
 * `MISE_SAFE=1` safe mode (a hard boundary against project config executing
 * code during `mise lock`) and `mise lock --bump` (advancing fuzzy selectors).
 *
 * Safe mode (jdx/mise#11146) and lockfile bumping (jdx/mise#11145) merged after
 * v2026.7.11, so the first release to include them is expected to be 2026.7.12.
 * TODO(mise-safe): confirm this once that release is tagged.
 *
 * @see https://github.com/jdx/mise/pull/11146
 * @see https://github.com/jdx/mise/pull/11145
 * @see https://mise.jdx.dev/configuration/settings.html#safe
 */
const MISE_SAFE_MODE_MIN_VERSION = '2026.7.12';

/**
 * Detects the mise version that will actually run, by executing `mise version`.
 * `mise version` only prints the binary's version — it does not load or execute
 * project configuration — so it is safe to run even without allowlisting.
 *
 * Output looks like `2026.7.12 macos-arm64 (2026-07-21)`; we take the leading
 * `major.minor.patch`. Returns `null` if the probe fails or cannot be parsed,
 * in which case callers fall back to the conservative (pre-safe-mode) behavior.
 */
async function detectMiseVersion(
  execOptions: ExecOptions,
): Promise<string | null> {
  try {
    const { stdout } = await exec('mise version', execOptions);
    const version = regEx(/\d+\.\d+\.\d+/).exec(stdout)?.[0];
    if (version && miseVersioning.isVersion(version)) {
      return version;
    }
    logger.debug({ stdout }, 'Could not parse mise version output');
    return null;
  } catch (err) {
    logger.debug({ err }, 'Failed to determine mise version');
    return null;
  }
}

/** True when `version` is at or above the safe-mode / `--bump` release. */
function versionSupportsSafeFeatures(version: string | null): boolean {
  return (
    !!version &&
    (miseVersioning.equals(version, MISE_SAFE_MODE_MIN_VERSION) ||
      miseVersioning.isGreaterThan(version, MISE_SAFE_MODE_MIN_VERSION))
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
  // `allowedUnsafeExecutions`. When the mise that will run supports safe mode,
  // we instead run with `MISE_SAFE=1`, which is a hard boundary against the
  // config executing code — so the allowlist is not required on that path.
  const allowlist = GlobalConfig.get('allowedUnsafeExecutions');
  const miseAllowlisted = allowlist.includes('mise');

  // The mise version is needed to decide safe mode (untrusted path) and
  // `mise lock --bump` (lock file maintenance). Detect it at runtime rather
  // than requiring a pinned `constraints.mise`. Skip the probe when it cannot
  // change the outcome: an allowlisted, non-maintenance run behaves the same
  // regardless of version.
  let miseSupportsSafeFeatures = false;
  if (!miseAllowlisted || config.isLockFileMaintenance) {
    const miseVersion = await detectMiseVersion({
      cwdFile: packageFileName,
      toolConstraints: [
        { toolName: 'mise', constraint: config.constraints?.mise },
      ],
      docker: {},
    });
    miseSupportsSafeFeatures = versionSupportsSafeFeatures(miseVersion);
  }

  const safeMode = !miseAllowlisted && miseSupportsSafeFeatures;
  if (!miseAllowlisted && !safeMode) {
    logger.once.warn(
      { safeModeMinVersion: MISE_SAFE_MODE_MIN_VERSION },
      '`mise lock` requires either `mise` in `allowedUnsafeExecutions`, or a mise version that supports safe mode',
    );
    return null;
  }

  const { isLocal, env } = getConfigType(packageFileName);
  const localFlag = isLocal ? ' --local' : '';

  let lockCmd: string;
  if (config.isLockFileMaintenance) {
    // Lock file maintenance means "update to the latest versions". Plain
    // `mise lock` only refreshes metadata for already-locked versions, so use
    // `mise lock --bump` to also advance fuzzy selectors (e.g. `node = "22"`)
    // to the latest matching version. `--bump` requires a new enough mise, so
    // fall back to a plain refresh when the version cannot be guaranteed.
    const bumpFlag = miseSupportsSafeFeatures ? ' --bump' : '';
    lockCmd = `mise lock${localFlag}${bumpFlag}`;
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

  // `mise trust` is only needed on the allowlisted path. In safe mode mise
  // loads untrusted config without a trust prompt (the config is inert — it
  // can neither execute code nor inject environment), so the trust step is
  // unnecessary and is skipped.
  const commands = safeMode
    ? [lockCmd]
    : [`mise trust ${quote(upath.basename(packageFileName))}`, lockCmd];

  try {
    await exec(commands, execOptions);
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
