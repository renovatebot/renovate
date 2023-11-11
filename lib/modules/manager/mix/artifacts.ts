import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  findLocalSiblingOrParent,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';

import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

const hexRepoUrl = 'https://hex.pm/';
const hexRepoOrgUrlRegex = regEx(
  `^https://hex\\.pm/api/repos/(?<organization>[a-z0-9_]+)/$`,
);

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`mix.getArtifacts(${packageFileName})`);
  if (updatedDeps.length < 1) {
    logger.debug('No updated mix deps - returning null');
    return null;
  }

  const lockFileName =
    (await findLocalSiblingOrParent(packageFileName, 'mix.lock')) ?? 'mix.lock';
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
  } catch (err) {
    logger.warn({ err }, 'mix.exs could not be written');
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }

  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
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
    if (matchHost) {
      const result = hexRepoOrgUrlRegex.exec(matchHost);

      if (result?.groups) {
        const { organization } = result.groups;
        organizations.add(organization);
      }
    }
  }

  for (const { packageName } of updatedDeps) {
    if (packageName) {
      const [, organization] = packageName.split(':');

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
      const authCommand = `mix hex.organization auth ${organization} --key ${token}`;
      return [...acc, authCommand];
    }

    return acc;
  }, [] as string[]);

  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    docker: {},
    toolConstraints: [
      {
        toolName: 'erlang',
        // https://hexdocs.pm/elixir/1.14.5/compatibility-and-deprecations.html#compatibility-between-elixir-and-erlang-otp
        constraint: config.constraints?.erlang ?? '^26',
      },
      {
        toolName: 'elixir',
        constraint: config.constraints?.elixir,
      },
    ],
    preCommands,
  };
  const command = [
    'mix',
    'deps.update',
    ...updatedDeps
      .map((dep) => dep.depName)
      .filter(is.string)
      .map((dep) => quote(dep)),
  ].join(' ');

  try {
    await exec(command, execOptions);
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }

    logger.debug(
      { err, message: err.message, command },
      'Failed to update Mix lock file',
    );

    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }

  const newMixLockContent = await readLocalFile(lockFileName, 'utf8');
  if (existingLockFileContent === newMixLockContent) {
    logger.debug('mix.lock is unchanged');
    return null;
  }
  logger.debug('Returning updated mix.lock');
  return [
    {
      file: {
        type: 'addition',
        path: lockFileName,
        contents: newMixLockContent,
      },
    },
  ];
}
