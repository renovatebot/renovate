import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { z } from 'zod';
import {
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
import {
  findGithubToken,
  takePersonalAccessTokenIfPossible,
} from '../../../util/check-token';
import { exec } from '../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../util/exec/types';
import {
  ensureCacheDir,
  ensureLocalDir,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getRepoStatus } from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
import { regEx } from '../../../util/regex';
import { Json } from '../../../util/schema-utils';
import { coerceString } from '../../../util/string';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { PackagistDatasource } from '../../datasource/packagist';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { Lockfile, PackageFile } from './schema';
import type { AuthJson } from './types';
import {
  extractConstraints,
  getComposerArguments,
  getPhpConstraint,
  isArtifactAuthEnabled,
  requireComposerDependencyInstallation,
} from './utils';

function getAuthJson(): string | null {
  const authJson: AuthJson = {};

  const githubHostRule = hostRules.find({
    hostType: 'github',
    url: 'https://api.github.com/',
  });

  const gitTagsHostRule = hostRules.find({
    hostType: GitTagsDatasource.id,
    url: 'https://github.com',
  });

  const selectedGithubToken = takePersonalAccessTokenIfPossible(
    isArtifactAuthEnabled(githubHostRule)
      ? findGithubToken(githubHostRule)
      : undefined,
    isArtifactAuthEnabled(gitTagsHostRule)
      ? findGithubToken(gitTagsHostRule)
      : undefined,
  );

  if (selectedGithubToken) {
    authJson['github-oauth'] = {
      'github.com': selectedGithubToken,
    };
  }

  for (const gitlabHostRule of hostRules.findAll({ hostType: 'gitlab' })) {
    if (!isArtifactAuthEnabled(gitlabHostRule)) {
      continue;
    }

    if (gitlabHostRule?.token) {
      const host = coerceString(gitlabHostRule.resolvedHost, 'gitlab.com');
      authJson['gitlab-token'] = authJson['gitlab-token'] ?? {};
      authJson['gitlab-token'][host] = gitlabHostRule.token;
      // https://getcomposer.org/doc/articles/authentication-for-private-packages.md#gitlab-token
      authJson['gitlab-domains'] = [
        host,
        ...(authJson['gitlab-domains'] ?? []),
      ];
    }
  }

  for (const packagistHostRule of hostRules.findAll({
    hostType: PackagistDatasource.id,
  })) {
    if (!isArtifactAuthEnabled(packagistHostRule)) {
      continue;
    }

    const { resolvedHost, username, password, token } = packagistHostRule;
    if (resolvedHost && username && password) {
      authJson['http-basic'] = authJson['http-basic'] ?? {};
      authJson['http-basic'][resolvedHost] = { username, password };
    } else if (resolvedHost && token) {
      authJson.bearer = authJson.bearer ?? {};
      authJson.bearer[resolvedHost] = token;
    }
  }

  return is.emptyObject(authJson) ? null : JSON.stringify(authJson);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`composer.updateArtifacts(${packageFileName})`);

  const file = Json.pipe(PackageFile).parse(newPackageFileContent);

  const lockFileName = packageFileName.replace(regEx(/\.json$/), '.lock');
  const lockfile = await z
    .string()
    .transform((f) => readLocalFile(f, 'utf8'))
    .pipe(Json)
    .pipe(Lockfile)
    .nullable()
    .catch(null)
    .parseAsync(lockFileName);
  if (!lockfile) {
    logger.debug('Composer: unable to read lockfile');
    return null;
  }

  const vendorDir = getSiblingFileName(packageFileName, 'vendor');
  const commitVendorFiles = await localPathExists(vendorDir);
  await ensureLocalDir(vendorDir);
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    const constraints = {
      ...extractConstraints(file, lockfile),
      ...config.constraints,
    };

    const composerToolConstraint: ToolConstraint = {
      toolName: 'composer',
      constraint: constraints.composer,
    };

    const phpToolConstraint: ToolConstraint = {
      toolName: 'php',
      constraint: getPhpConstraint(constraints),
    };

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      extraEnv: {
        COMPOSER_CACHE_DIR: await ensureCacheDir('composer'),
        COMPOSER_AUTH: getAuthJson(),
      },
      toolConstraints: [phpToolConstraint, composerToolConstraint],
      docker: {},
    };

    const commands: string[] = [];

    // Determine whether install is required before update
    if (requireComposerDependencyInstallation(lockfile)) {
      const preCmd = 'composer';
      const preArgs =
        'install' + getComposerArguments(config, composerToolConstraint);
      logger.trace({ preCmd, preArgs }, 'composer pre-update command');
      commands.push('git stash -- composer.json');
      commands.push(`${preCmd} ${preArgs}`);
      commands.push('git stash pop || true');
    }

    const cmd = 'composer';
    let args: string;
    if (config.isLockFileMaintenance) {
      args = 'update';
    } else {
      args =
        (
          'update ' +
          updatedDeps
            .map((dep) =>
              dep.newVersion ? `${dep.depName}:${dep.newVersion}` : dep.depName,
            )
            .filter(is.string)
            .map((dep) => quote(dep))
            .join(' ')
        ).trim() + ' --with-dependencies';
    }
    args += getComposerArguments(config, composerToolConstraint);
    logger.trace({ cmd, args }, 'composer command');
    commands.push(`${cmd} ${args}`);

    await exec(commands, execOptions);
    const status = await getRepoStatus();
    if (!status.modified.includes(lockFileName)) {
      return null;
    }
    logger.debug('Returning updated composer.lock');
    const res: UpdateArtifactsResult[] = [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: await readLocalFile(lockFileName),
        },
      },
    ];

    if (!commitVendorFiles) {
      return res;
    }

    logger.debug(`Committing vendor files in ${vendorDir}`);
    for (const f of [...status.modified, ...status.not_added]) {
      if (f.startsWith(vendorDir)) {
        res.push({
          file: {
            type: 'addition',
            path: f,
            contents: await readLocalFile(f),
          },
        });
      }
    }
    for (const f of status.deleted) {
      res.push({
        file: {
          type: 'deletion',
          path: f,
        },
      });
    }

    return res;
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    if (
      err.message?.includes(
        'Your requirements could not be resolved to an installable set of packages.',
      )
    ) {
      logger.info('Composer requirements cannot be resolved');
    } else if (err.message?.includes('write error (disk full?)')) {
      throw new Error(SYSTEM_INSUFFICIENT_DISK_SPACE);
    } else {
      logger.debug({ err }, 'Failed to generate composer.lock');
    }
    return [
      {
        artifactError: {
          lockFile: lockFileName,
          stderr: err.message,
        },
      },
    ];
  }
}
