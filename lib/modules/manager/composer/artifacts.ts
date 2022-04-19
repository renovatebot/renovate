import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { PlatformId } from '../../../constants';
import {
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
} from '../../../constants/error-messages';
import { logger } from '../../../logger';
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
import { PackagistDatasource } from '../../datasource/packagist';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import type { AuthJson, ComposerLock } from './types';
import {
  composerVersioningId,
  extractContraints,
  getComposerArguments,
  getPhpConstraint,
  requireComposerDependencyInstallation,
} from './utils';

function getAuthJson(): string | null {
  const authJson: AuthJson = {};

  const githubCredentials = hostRules.find({
    hostType: PlatformId.Github,
    url: 'https://api.github.com/',
  });
  if (githubCredentials?.token) {
    authJson['github-oauth'] = {
      'github.com': githubCredentials.token.replace('x-access-token:', ''),
    };
  }

  hostRules
    .findAll({ hostType: PlatformId.Gitlab })
    ?.forEach((gitlabHostRule) => {
      if (gitlabHostRule?.token) {
        const host = gitlabHostRule.resolvedHost || 'gitlab.com';
        authJson['gitlab-token'] = authJson['gitlab-token'] || {};
        authJson['gitlab-token'][host] = gitlabHostRule.token;
        // https://getcomposer.org/doc/articles/authentication-for-private-packages.md#gitlab-token
        authJson['gitlab-domains'] = [
          host,
          ...(authJson['gitlab-domains'] || []),
        ];
      }
    });

  hostRules
    .findAll({ hostType: PackagistDatasource.id })
    ?.forEach((hostRule) => {
      const { resolvedHost, username, password, token } = hostRule;
      if (resolvedHost && username && password) {
        authJson['http-basic'] = authJson['http-basic'] || {};
        authJson['http-basic'][resolvedHost] = { username, password };
      } else if (resolvedHost && token) {
        authJson.bearer = authJson.bearer || {};
        authJson.bearer[resolvedHost] = token;
      }
    });

  return is.emptyObject(authJson) ? null : JSON.stringify(authJson);
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`composer.updateArtifacts(${packageFileName})`);

  const lockFileName = packageFileName.replace(regEx(/\.json$/), '.lock');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug('No composer.lock found');
    return null;
  }

  const vendorDir = getSiblingFileName(packageFileName, 'vendor');
  const commitVendorFiles = await localPathExists(vendorDir);
  await ensureLocalDir(vendorDir);
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    const existingLockFile: ComposerLock = JSON.parse(existingLockFileContent);
    const constraints = {
      ...extractContraints(JSON.parse(newPackageFileContent), existingLockFile),
      ...config.constraints,
    };

    const composerToolConstraint: ToolConstraint = {
      toolName: 'composer',
      constraint: constraints.composer,
    };

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      extraEnv: {
        COMPOSER_CACHE_DIR: await ensureCacheDir('composer'),
        COMPOSER_AUTH: getAuthJson(),
      },
      toolConstraints: [composerToolConstraint],
      docker: {
        image: 'php',
        tagConstraint: getPhpConstraint(constraints),
        tagScheme: composerVersioningId,
      },
    };

    const commands: string[] = [];

    // Determine whether install is required before update
    if (requireComposerDependencyInstallation(existingLockFile)) {
      const preCmd = 'composer';
      const preArgs =
        'install' + getComposerArguments(config, composerToolConstraint);
      logger.debug({ preCmd, preArgs }, 'composer pre-update command');
      commands.push(`${preCmd} ${preArgs}`);
    }

    const cmd = 'composer';
    let args: string;
    if (config.isLockFileMaintenance) {
      args = 'update';
    } else {
      args =
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        (
          'update ' + updatedDeps.map((dep) => quote(dep.depName!)).join(' ')
        ).trim() + ' --with-dependencies';
    }
    args += getComposerArguments(config, composerToolConstraint);
    logger.debug({ cmd, args }, 'composer command');
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
        'Your requirements could not be resolved to an installable set of packages.'
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
