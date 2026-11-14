import { isEmptyArray, isString } from '@sindresorhus/is';
import semver from 'semver';
import { quote } from 'shlex';
import { GlobalConfig } from '../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { resolveConstraint } from '../../../util/exec/containerbase.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types.ts';
import {
  deleteLocalFile,
  ensureCacheDir,
  findLocalSiblingOrParent,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
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

// https://hexdocs.pm/elixir/compatibility-and-deprecations.html#between-elixir-and-erlang-otp
const defaultErlangVersion = '22';

// highest supported erlang major per minimum elixir version, newest elixir first
// TODO: replace once a datasource provides erlang constraints per elixir release
const elixirErlangVersions = [
  { elixir: '1.20.0', erlang: '29' },
  { elixir: '1.19.0', erlang: '28' },
  { elixir: '1.18.0', erlang: '27' },
  { elixir: '1.17.0', erlang: '27' },
  { elixir: '1.16.0', erlang: '26' },
  { elixir: '1.15.0', erlang: '26' },
  { elixir: '1.14.0', erlang: '25' },
  { elixir: '1.13.4', erlang: '25' },
  { elixir: '1.13.0', erlang: '24' },
  { elixir: '1.12.0', erlang: '24' },
  { elixir: '1.11.4', erlang: '24' },
  { elixir: '1.11.0', erlang: '23' },
  { elixir: '1.10.3', erlang: '23' },
  { elixir: '1.10.0', erlang: '22' },
  { elixir: '1.7.0', erlang: '22' },
];

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`mix.getArtifacts(${packageFileName})`);
  const { isLockFileMaintenance } = config;

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
    if (isLockFileMaintenance) {
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

  try {
    await exec(command, execOptions);
  } catch (err) {
    /* v8 ignore if -- defensive rethrow of TEMPORARY_ERROR from exec, not reproduced in mix specs */
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }

    logger.debug(
      { err, message: err.message, command },
      'Failed to update Mix lock file',
    );

    return artifactErrorResult(lockFileName, err);
  }

  const newMixLockContent = await readLocalFile(lockFileName, 'utf8');
  if (existingLockFileContent === newMixLockContent) {
    logger.debug('mix.lock is unchanged');
    return null;
  }
  logger.debug('Returning updated mix.lock');
  return [fileAddition(lockFileName, newMixLockContent)];
}

/**
 * Returns the erlang and elixir tool constraints, picking the erlang version from the resolved elixir version unless erlang is constrained.
 */
async function getToolConstraints(
  config: UpdateArtifactsConfig,
): Promise<ToolConstraint[]> {
  const erlangConstraint = await resolveToolConstraint(config, 'erlang');
  const elixirConstraint = await resolveToolConstraint(config, 'elixir');
  const binarySource = GlobalConfig.get('binarySource');
  const installsTools = binarySource === 'docker' || binarySource === 'install';

  if (erlangConstraint || !installsTools) {
    return [
      {
        toolName: 'erlang',
        constraint: erlangConstraint ?? defaultErlangVersion,
      },
      { toolName: 'elixir', constraint: elixirConstraint },
    ];
  }

  const elixirVersion = await resolveConstraint({
    toolName: 'elixir',
    constraint: elixirConstraint,
  });
  const erlangVersion =
    elixirErlangVersions.find(({ elixir }) =>
      semver.satisfies(elixirVersion, `>=${elixir}`, {
        includePrerelease: true,
      }),
    )?.erlang ?? defaultErlangVersion;
  logger.debug(
    `Using erlang ${erlangVersion} for elixir ${elixirVersion} in mix artifacts`,
  );

  return [
    { toolName: 'erlang', constraint: erlangVersion },
    { toolName: 'elixir', constraint: elixirVersion },
  ];
}

async function checkLockFileReadError(
  lockFileName: string,
): Promise<UpdateArtifactsResult[] | null> {
  if (await localPathExists(lockFileName)) {
    return [artifactError(lockFileName, `Error reading ${lockFileName}`)];
  }
  return null;
}
