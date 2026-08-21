import { isEmptyArray, isString } from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ExecOptions } from '../../../util/exec/types.ts';
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
import * as hostRules from '../../../util/host-rules.ts';
import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider.ts';
import { Http } from '../../../util/http/index.ts';
import { regEx } from '../../../util/regex.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { HexDatasource } from '../../datasource/hex/index.ts';

import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { getRepoOptions } from './utils.ts';

const http = new Http(HexDatasource.id);

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
    existingLockFileContent =
      parentLockFileName && (await readLocalFile(parentLockFileName, 'utf8'));

    if (parentLockFileName && existingLockFileContent) {
      lockFileName = parentLockFileName;
      isUmbrella = true;
    } else if (parentLockFileName) {
      const lockFileError = await checkLockFileReadError(parentLockFileName);
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
    return [
      {
        artifactError: {
          fileName: lockFileName,
          stderr: err.message,
        },
      },
    ];
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
      const authCommand = `mix hex.organization auth ${quote(organization)} --key ${quote(token)}`;
      return [...acc, authCommand];
    }

    return acc;
  }, [] as string[]);

  const hexHome = await hexHomeDir();

  preCommands.push(
    ...(await getRepoAddCommands(
      newPackageFileContent,
      config.registryAliases,
      hexHome,
    )),
  );

  // renovate: will update this
  const erlangVersion = '26';

  const execOptions: ExecOptions = {
    extraEnv: {
      // https://hexdocs.pm/mix/1.15.0/Mix.Tasks.Archive.html
      // TODO: should include a version constraint
      MIX_ARCHIVES: await ensureCacheDir('mix_archives'),
      // `mix hex.organization auth` and `mix hex.repo add` persist registry
      // URLs and their credentials in `$HEX_HOME/hex.config`. Keep that under
      // privateCacheDir, which is wiped between repositories, so credentials
      // cannot leak into the next repository of the same run.
      HEX_HOME: hexHome,
    },
    cwdFile: packageFileName,
    docker: {},
    toolConstraints: [
      {
        toolName: 'erlang',
        // https://hexdocs.pm/elixir/1.14.5/compatibility-and-deprecations.html#compatibility-between-elixir-and-erlang-otp
        constraint: config.constraints?.erlang ?? `^${erlangVersion}`,
      },
      {
        toolName: 'elixir',
        constraint: config.constraints?.elixir,
      },
    ],
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

    return [
      {
        artifactError: {
          fileName: lockFileName,
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

async function hexHomeDir(): Promise<string> {
  const dir = upath.join(privateCacheDir(), 'hex');
  await ensureDir(dir);
  return dir;
}

/**
 * `mix` will not fetch from a third-party repo unless a registry public key is
 * stored for it — with none, `:mix_hex_registry.key(nil)` raises and the fetch
 * hangs until the registry timeout. `registryAliases` is a name-to-URL map with
 * nowhere to put a key or its fingerprint, so we fetch the key from the registry
 * ourselves. This is the same trust-on-first-use model the hex datasource
 * already applies when it verifies V2 payloads.
 *
 * `registryAliases` is inherited from top-level config, so it may hold entries
 * belonging to other managers. Only the repos `mix.exs` declares are added.
 */
async function getRepoAddCommands(
  packageFileContent: string,
  registryAliases: Record<string, string> | undefined,
  hexHome: string,
): Promise<string[]> {
  const commands: string[] = [];
  const declaredRepos = new Set(getRepoOptions(packageFileContent));

  for (const [name, url] of Object.entries(registryAliases ?? {})) {
    // `hexpm` and `hexpm:<org>` are hex.pm itself, authenticated above through
    // `mix hex.organization auth`.
    if (
      !declaredRepos.has(name) ||
      name === 'hexpm' ||
      name.startsWith('hexpm:')
    ) {
      continue;
    }

    const publicKey = await getRegistryPublicKey(url);
    if (!publicKey) {
      logger.warn(
        { repo: name, url },
        'Skipping hex repo, unable to fetch its registry public key',
      );
      continue;
    }

    const keyFile = upath.join(hexHome, `${name}.pem`);
    await outputCacheFile(keyFile, publicKey);

    logger.debug(`Adding hex repo ${name}`);
    const command = [
      'mix',
      'hex.repo',
      'add',
      quote(name),
      quote(url),
      '--public-key',
      quote(keyFile),
    ];

    // An unauthenticated third-party registry still needs adding, so a missing
    // token is not a reason to skip the repo.
    const { token } = hostRules.find({ hostType: HexDatasource.id, url });
    if (token) {
      command.push('--auth-key', quote(token));
    } else {
      logger.debug(`No hostRules token found for hex repo ${name}`);
    }

    commands.push(command.join(' '));
  }

  return commands;
}

async function getRegistryPublicKey(url: string): Promise<string | null> {
  const keyUrl = joinUrlParts(url, 'public_key');
  try {
    const { body } = await http.getText(keyUrl, {
      cacheProvider: memCacheProvider,
    });
    return body.trim() || null;
  } catch (err) {
    logger.debug({ err, keyUrl }, 'Failed to fetch hex registry public key');
    return null;
  }
}

async function checkLockFileReadError(
  lockFileName: string,
): Promise<UpdateArtifactsResult[] | null> {
  if (await localPathExists(lockFileName)) {
    return [
      {
        artifactError: {
          fileName: lockFileName,
          stderr: `Error reading ${lockFileName}`,
        },
      },
    ];
  }
  return null;
}
