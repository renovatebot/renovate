import { isNonEmptyArray, isString } from '@sindresorhus/is';
import { Duration } from 'luxon';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
import {
  ensureCacheDir,
  getSiblingFileName,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { withGitEnvironment } from '../../../util/git/exec.ts';
import {
  calculatePackageManagerMinimumReleaseAgeMs,
  getMinimumReleaseAgeExemption,
} from '../../../util/minimum-release-age.ts';
import { regEx } from '../../../util/regex.ts';
import { Result } from '../../../util/result.ts';
import {
  massage as massageToml,
  parse as parseToml,
} from '../../../util/toml.ts';
import { findPypiIndexCredentials } from '../../datasource/pypi/host-rules.ts';
import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
  Upgrade,
} from '../types.ts';
import {
  artifactErrorResult,
  resolveToolConstraint,
  updateLockFile,
} from '../util.ts';
import { Lockfile, PoetryPyProject } from './schema.ts';
import type { PoetryFile, PoetrySource } from './types.ts';
import { getLockfilePoetryVersion } from './utils.ts';

const gitExec = withGitEnvironment(['poetry']);

export function getPythonConstraint(
  pyProjectContent: string,
  existingLockFileContent: string,
): string | null {
  // Read Python version from `pyproject.toml` first as it could have been updated
  const pyprojectPythonConstraint = Result.parse(
    massageToml(pyProjectContent),
    PoetryPyProject.transform(
      ({ packageFileContent }) =>
        packageFileContent.deps.find((dep) => dep.depName === 'python')
          ?.currentValue,
    ),
  ).unwrapOrNull();
  if (pyprojectPythonConstraint) {
    logger.debug('Using python version from pyproject.toml');
    return pyprojectPythonConstraint;
  }

  const lockfilePythonConstraint = Result.parse(
    existingLockFileContent,
    Lockfile.transform(({ pythonVersions }) => pythonVersions),
  ).unwrapOrNull();
  if (lockfilePythonConstraint) {
    logger.debug('Using python version from poetry.lock');
    return lockfilePythonConstraint;
  }

  return null;
}

export function getPoetryRequirement(
  pyProjectContent: string,
  existingLockFileContent: string,
): undefined | string | null {
  const lockfilePoetryVersion = getLockfilePoetryVersion(
    existingLockFileContent,
  );
  if (lockfilePoetryVersion) {
    logger.debug(
      `Using poetry version ${lockfilePoetryVersion} from poetry.lock`,
    );
    return lockfilePoetryVersion;
  }

  const { val: pyprojectPoetryConstraint } = Result.parse(
    massageToml(pyProjectContent),
    PoetryPyProject.transform(({ poetryRequirement }) => poetryRequirement),
  ).unwrap();
  if (pyprojectPoetryConstraint) {
    logger.debug(
      `Using poetry version ${pyprojectPoetryConstraint} from pyproject.toml`,
    );
    return pyprojectPoetryConstraint;
  }

  return null;
}

function getPoetrySources(content: string, fileName: string): PoetrySource[] {
  let pyprojectFile: PoetryFile;
  try {
    pyprojectFile = parseToml(massageToml(content)) as PoetryFile;
  } catch (err) {
    logger.debug({ err }, 'Error parsing pyproject.toml file');
    return [];
  }
  if (!pyprojectFile.tool?.poetry) {
    logger.debug(`${fileName} contains no poetry section`);
    return [];
  }

  const sources = coerceArray(pyprojectFile.tool?.poetry?.source);
  const sourceArray: PoetrySource[] = [];
  for (const source of sources) {
    if (source.name && source.url) {
      sourceArray.push({ name: source.name, url: source.url });
    }
  }
  return sourceArray;
}

async function getSourceCredentialVars(
  pyprojectContent: string,
  packageFileName: string,
): Promise<NodeJS.ProcessEnv> {
  const poetrySources = getPoetrySources(pyprojectContent, packageFileName);
  const envVars: NodeJS.ProcessEnv = {};

  for (const source of poetrySources) {
    const matchingHostRule = await findPypiIndexCredentials(source.url);
    const formattedSourceName = source.name
      .replace(regEx(/(?:\.|-)+/g), '_')
      .toUpperCase();
    if (matchingHostRule.username) {
      envVars[`POETRY_HTTP_BASIC_${formattedSourceName}_USERNAME`] =
        matchingHostRule.username;
    }
    if (matchingHostRule.password) {
      envVars[`POETRY_HTTP_BASIC_${formattedSourceName}_PASSWORD`] =
        matchingHostRule.password;
    }
  }
  return envVars;
}

interface MinReleaseAgeEnv {
  env: NodeJS.ProcessEnv;
  notice?: string;
}

/**
 * Returns the `POETRY_SOLVER_MIN_RELEASE_AGE` for the lock file update, lowered to the smaller `minimumReleaseAge` of exempted updates, and the notice for such a lowering.
 */
function getMinReleaseAgeEnv(
  config: UpdateArtifactsConfig,
  packageFileName: string,
  updatedDeps: Upgrade[],
): MinReleaseAgeEnv {
  const ageMs = calculatePackageManagerMinimumReleaseAgeMs({
    config,
    manager: 'poetry',
    packageFile: packageFileName,
    upgrades: updatedDeps,
  });
  if (!ageMs) {
    return { env: {} };
  }
  const days = Math.ceil(Duration.fromMillis(ageMs).as('days'));
  const exemption = getMinimumReleaseAgeExemption(updatedDeps, 'poetry', ageMs);
  if (!exemption) {
    return { env: { POETRY_SOLVER_MIN_RELEASE_AGE: days.toString() } };
  }
  // rounds down, so that Poetry accepts the releases of the exempted updates
  const loweredDays = Math.floor(
    Duration.fromMillis(exemption.ageMs).as('days'),
  );
  logger.debug(
    `Lowering the Poetry minimum release age from ${days} to ${loweredDays} days, as the minimumReleaseAge of ${exemption.depNames.join(', ')} is smaller and their release is younger or has no timestamp`,
  );
  const packages = exemption.depNames.map((name) => `\`${name}\``).join(', ');
  return {
    // `0` also overrides `solver.min-release-age` of the Poetry config
    env: { POETRY_SOLVER_MIN_RELEASE_AGE: loweredDays.toString() },
    notice: `Poetry checked a minimum release age of ${loweredDays} days instead of ${days} for this update, because the \`minimumReleaseAge\` of ${packages} is smaller. Poetry has no per-package exclude.`,
  };
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`poetry.updateArtifacts(${packageFileName})`);
  const { isLockFileMaintenance } = config;

  if (!isNonEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated poetry deps - returning null');
    return null;
  }
  // Try poetry.lock first
  let lockFileName = getSiblingFileName(packageFileName, 'poetry.lock');
  let existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    // Try pyproject.lock next
    lockFileName = getSiblingFileName(packageFileName, 'pyproject.lock');
    existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (!existingLockFileContent) {
      logger.debug(`No lock file found`);
      return null;
    }
  }
  // a const, so the closure below keeps the narrowing to string
  const lockFileContent = existingLockFileContent;
  logger.debug(`Updating ${lockFileName}`);
  const cmd: string[] = [];
  if (isLockFileMaintenance) {
    cmd.push('poetry update --lock --no-interaction');
  } else {
    cmd.push(
      `poetry update --lock --no-interaction ${updatedDeps
        .map((dep) => dep.depName)
        .filter(isString)
        .map((dep) => quote(dep))
        .join(' ')}`,
    );
  }

  const { env: minReleaseAgeEnv, notice } = getMinReleaseAgeEnv(
    config,
    packageFileName,
    updatedDeps,
  );

  try {
    const results = await updateLockFile({
      lockFileName,
      existingLockFileContent,
      packageFile: { path: packageFileName, contents: newPackageFileContent },
      deleteLockFile: isLockFileMaintenance,
      run: async () => {
        const pythonConstraint = await resolveToolConstraint(
          config,
          'python',
          () => getPythonConstraint(newPackageFileContent, lockFileContent),
        );
        const poetryConstraint = await resolveToolConstraint(
          config,
          'poetry',
          () => getPoetryRequirement(newPackageFileContent, lockFileContent),
        );
        const extraEnv: NodeJS.ProcessEnv = {
          ...(await getSourceCredentialVars(
            newPackageFileContent,
            packageFileName,
          )),
          PIP_CACHE_DIR: await ensureCacheDir('pip'),
          ...minReleaseAgeEnv,
        };

        const execOptions: ExecOptions = {
          cwdFile: packageFileName,
          extraEnv,
          docker: {},
          toolConstraints: [
            { toolName: 'python', constraint: pythonConstraint },
            { toolName: 'poetry', constraint: poetryConstraint },
          ],
        };
        await gitExec(cmd, execOptions);
      },
    });
    if (!notice || !results) {
      return results;
    }
    return results.map(({ file }) => ({
      file,
      notice: { file: lockFileName, message: notice },
    }));
  } catch (err) {
    /* v8 ignore if -- defensive rethrow, not reproduced in the poetry specs */
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, `Failed to update ${lockFileName} file`);
    return artifactErrorResult(lockFileName, err);
  }
}
