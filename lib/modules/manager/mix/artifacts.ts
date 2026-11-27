import { validateHeaderValue } from 'node:http';
import { join } from 'node:path';
import { isEmptyArray, isString } from '@sindresorhus/is';
import semver from 'semver';
import { quote } from 'shlex';
import tmp from 'tmp-promise';
import { GlobalConfig } from '../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types.ts';
import {
  deleteLocalFile,
  ensureCacheDir,
  ensureDir,
  findLocalSiblingOrParent,
  getSiblingFileName,
  localPathExists,
  outputCacheFile,
  privateCacheDir,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import {
  HexRepositories,
  type HexRepository,
  preflightHexRepository,
  resolveHexPublicKey,
} from '../../../util/hex-repository.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { coerceObject } from '../../../util/object.ts';
import { regEx } from '../../../util/regex.ts';

import type {
  UpdateArtifact,
  UpdateArtifactsConfig,
  UpdateArtifactsResult,
} from '../types.ts';
import {
  artifactError,
  artifactErrorResult,
  fileAddition,
  resolveToolConstraint,
} from '../util.ts';

const hexRepoUrl = 'https://hex.pm/';
const hexRepoOrgUrlRegex = regEx(
  `^https://hex\\.pm/api/repos/(?<organization>[a-z0-9_]+)/$`,
);

// oldest erlang major containerbase provides
const defaultErlangConstraint = '24';

// supported erlang range per elixir minor, newest elixir first
// https://hexdocs.pm/elixir/compatibility-and-deprecations.html#between-elixir-and-erlang-otp
// TODO: replace with the erlang constraints of the containerbase datasource
const elixirErlangConstraints = [
  { elixir: '1.20.x', erlang: '>=27 <30' },
  { elixir: '1.19.x', erlang: '>=26 <29' },
  { elixir: '1.18.x', erlang: '>=25 <28' },
  { elixir: '1.17.x', erlang: '>=25 <28' },
  { elixir: '1.16.x', erlang: '>=24 <27' },
  { elixir: '1.15.x', erlang: '>=24 <27' },
  { elixir: '1.14.x', erlang: '>=23 <26' },
];

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`mix.getArtifacts(${packageFileName})`);
  const { isLockFileMaintenance } = config;
  const hasPrivateRepositories =
    Object.keys(coerceObject(config.hexRepositories)).length > 0;

  if (isEmptyArray(updatedDeps) && !isLockFileMaintenance) {
    logger.debug('No updated mix deps');
    return null;
  }

  let lockFileName = getSiblingFileName(packageFileName, 'mix.lock');
  let isUmbrella = false;

  let existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    const lockFileError = await checkLockFileReadError(lockFileName);
    if (lockFileError) {
      return lockFileError;
    }

    const parentLockFileName = await findLocalSiblingOrParent(
      packageFileName,
      'mix.lock',
    );
    existingLockFileContent = null;
    if (parentLockFileName) {
      existingLockFileContent = await readLocalFile(parentLockFileName, 'utf8');
    }

    if (parentLockFileName && existingLockFileContent) {
      lockFileName = parentLockFileName;
      isUmbrella = true;
    } else if (parentLockFileName) {
      const lockFileError = await checkLockFileReadError(parentLockFileName);
      // v8 ignore else -- needs an umbrella parent lock file that reads cleanly
      if (lockFileError) {
        return lockFileError;
      }
    }
  }

  if (isLockFileMaintenance && isUmbrella) {
    logger.debug(
      `Cannot use lockFileMaintenance in an umbrella project, see ${GlobalConfig.get('productLinks').documentation}modules/manager/mix/#lockFileMaintenance`,
    );
    return null;
  }

  if (isLockFileMaintenance && !existingLockFileContent) {
    logger.debug(
      'Cannot use lockFileMaintenance when no mix.lock file is present',
    );
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    if (isLockFileMaintenance && !hasPrivateRepositories) {
      await deleteLocalFile(lockFileName);
    }
  } catch (err) {
    logger.warn({ err }, 'mix.exs could not be written');
    return artifactErrorResult(lockFileName, err);
  }

  if (!existingLockFileContent) {
    logger.debug('No mix.lock found');
    return null;
  }

  const organizations = new Set<string>();

  const hexHostRulesWithMatchHost = hostRules
    .getAll()
    .filter(
      (hostRule) =>
        !!hostRule.matchHost && hexRepoOrgUrlRegex.test(hostRule.matchHost),
    );

  for (const { matchHost } of hexHostRulesWithMatchHost) {
    // v8 ignore else -- the filter above already required a match host
    if (matchHost) {
      const result = hexRepoOrgUrlRegex.exec(matchHost);

      // v8 ignore else -- the same regex already matched in that filter
      if (result?.groups) {
        const { organization } = result.groups;
        organizations.add(organization);
      }
    }
  }

  for (const { packageName } of updatedDeps) {
    if (packageName) {
      const [, organization] = packageName.split(':');

      // v8 ignore else -- needs an updated dep whose name carries no organization
      if (organization) {
        organizations.add(organization);
      }
    }
  }

  const preCommands = Array.from(organizations).reduce((acc, organization) => {
    const url = `${hexRepoUrl}api/repos/${organization}/`;
    const { token } = hostRules.find({ url });

    if (token) {
      logger.debug(`Authenticating to hex organization ${organization}`);
      const authCommand = `mix hex.organization auth ${quote(organization)} --key ${quote(token)}`;
      return [...acc, authCommand];
    }

    return acc;
  }, [] as string[]);

  const execOptions: ExecOptions = {
    extraEnv: {
      // https://hexdocs.pm/mix/1.15.0/Mix.Tasks.Archive.html
      // TODO: should include a version constraint
      MIX_ARCHIVES: await ensureCacheDir('mix_archives'),
    },
    cwdFile: lockFileName,
    docker: {},
    toolConstraints: await getToolConstraints(config),
    preCommands,
  };

  let command: string;
  if (isLockFileMaintenance) {
    command = 'mix deps.get';
  } else {
    command = [
      'mix',
      'deps.update',
      ...updatedDeps
        .map((dep) => dep.depName)
        .filter(isString)
        .map((dep) => quote(dep)),
    ].join(' ');
  }

  let cleanup: (() => Promise<void>) | undefined;
  let lockFileDeleted = false;
  try {
    if (hasPrivateRepositories) {
      checkHexHomeAccess();
      const repositories = HexRepositories.parse(config.hexRepositories);
      const cacheDir = privateCacheDir();
      await ensureDir(cacheDir);
      const hexHome = await tmp.dir({
        tmpdir: cacheDir,
        unsafeCleanup: true,
        mode: 0o700,
      });
      cleanup = hexHome.cleanup;
      const repoCommands = await prepareHexRepositories(
        hexHome.path,
        repositories,
      );
      const hexEnv = {
        HEX_HOME: hexHome.path,
        HEX_NO_VERIFY_REPO_ORIGIN: '0',
        HEX_UNSAFE_REGISTRY: '0',
      };
      if (isLockFileMaintenance) {
        await deleteLocalFile(lockFileName);
        lockFileDeleted = true;
      }
      await exec([...repoCommands, ...preCommands, command], {
        ...execOptions,
        preCommands: [],
        extraEnv: { ...execOptions.extraEnv, ...hexEnv },
        env: hexEnv,
        redactOutput: true,
      });
    } else {
      await exec(command, execOptions);
    }
  } catch (err) {
    if (lockFileDeleted) {
      await writeLocalFile(lockFileName, existingLockFileContent);
    }
    /* v8 ignore if -- defensive rethrow of TEMPORARY_ERROR from exec, not reproduced in mix specs */
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }

    logger.debug(
      { err, message: err.message, command },
      'Failed to update Mix lock file',
    );

    return artifactErrorResult(lockFileName, err);
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }

  const newMixLockContent = await readLocalFile(lockFileName, 'utf8');
  if (existingLockFileContent === newMixLockContent) {
    logger.debug('mix.lock is unchanged');
    return null;
  }
  logger.debug('Returning updated mix.lock');
  return [fileAddition(lockFileName, newMixLockContent)];
}

function checkHexHomeAccess(): void {
  const { binarySource, dockerUser } = GlobalConfig.get();
  if (binarySource === 'docker') {
    const uid = dockerUser?.split(':')[0];
    const canAccess = uid === '0' || uid === process.getuid?.().toString();
    if (!canAccess || !uid) {
      throw new Error(
        "Private Hex repositories require dockerUser to be Renovate's numeric UID or 0 so Mix can access its private HEX_HOME.",
      );
    }
  }
}

async function prepareHexRepositories(
  hexHome: string,
  repositories: Record<string, HexRepository>,
): Promise<string[]> {
  const commands: string[] = [];
  for (const [name, repository] of Object.entries(repositories)) {
    const authorization = await preflightHexRepository(repository);
    const publicKey = await resolveHexPublicKey(name, repository);
    const publicKeyPath = join(hexHome, `${name}.pem`);
    await outputCacheFile(publicKeyPath, publicKey);
    const register = `mix hex.repo add ${quote(name)} ${quote(repository.url)} --public-key ${quote(publicKeyPath)}`;
    if (authorization === undefined) {
      commands.push(register);
    } else {
      validateHeaderValue('authorization', authorization);
      const authFile = join(hexHome, `${name}.auth`);
      await outputCacheFile(authFile, authorization, { mode: 0o600 });
      // Read the secret inside the execution environment so it stays out of
      // Renovate's command line, environment, and logs.
      const script = `auth_key=$(cat ${quote(authFile)}) && ${register} --auth-key="$auth_key" && rm ${quote(authFile)}`;
      commands.push(`sh -c ${quote(script)}`);
    }
  }
  return commands;
}

/**
 * Returns the erlang and elixir tool constraints, taking erlang from the elixir constraint unless erlang is constrained.
 */
async function getToolConstraints(
  config: UpdateArtifactsConfig,
): Promise<ToolConstraint[]> {
  const elixirConstraint = await resolveToolConstraint(config, 'elixir');
  const erlangConstraint =
    (await resolveToolConstraint(config, 'erlang')) ??
    getErlangConstraint(elixirConstraint);

  return [
    { toolName: 'erlang', constraint: erlangConstraint },
    { toolName: 'elixir', constraint: elixirConstraint },
  ];
}

/**
 * Returns the erlang range of the newest elixir minor within the elixir constraint, or the default erlang constraint.
 */
function getErlangConstraint(elixirConstraint: string | undefined): string {
  const elixirRange = semver.validRange(elixirConstraint) ?? '*';
  const erlangConstraint =
    elixirErlangConstraints.find(({ elixir }) =>
      semver.intersects(elixir, elixirRange, { includePrerelease: true }),
    )?.erlang ?? defaultErlangConstraint;
  logger.debug(
    `Using erlang ${erlangConstraint} for elixir ${elixirConstraint} in mix artifacts`,
  );
  return erlangConstraint;
}

async function checkLockFileReadError(
  lockFileName: string,
): Promise<UpdateArtifactsResult[] | null> {
  if (await localPathExists(lockFileName)) {
    return [artifactError(lockFileName, `Error reading ${lockFileName}`)];
  }
  return null;
}
