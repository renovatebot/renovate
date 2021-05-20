import is from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { getAdminConfig } from '../../config/admin';
import {
  SYSTEM_INSUFFICIENT_DISK_SPACE,
  TEMPORARY_ERROR,
} from '../../constants/error-messages';
import {
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../constants/platforms';
import * as datasourcePackagist from '../../datasource/packagist';
import { logger } from '../../logger';
import { ExecOptions, exec } from '../../util/exec';
import {
  deleteLocalFile,
  ensureDir,
  ensureLocalDir,
  getSiblingFileName,
  localPathExists,
  readLocalFile,
  writeLocalFile,
} from '../../util/fs';
import { getRepoStatus } from '../../util/git';
import * as hostRules from '../../util/host-rules';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import type { AuthJson } from './types';
import { composerVersioningId, getConstraint } from './utils';

function getAuthJson(): string | null {
  const authJson: AuthJson = {};

  const githubCredentials = hostRules.find({
    hostType: PLATFORM_TYPE_GITHUB,
    url: 'https://api.github.com/',
  });
  if (githubCredentials?.token) {
    authJson['github-oauth'] = {
      'github.com': githubCredentials.token.replace('x-access-token:', ''),
    };
  }

  hostRules
    .findAll({ hostType: PLATFORM_TYPE_GITLAB })
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
    .findAll({ hostType: datasourcePackagist.id })
    ?.forEach((hostRule) => {
      const { resolvedHost, username, password } = hostRule;
      if (resolvedHost && username && password) {
        authJson['http-basic'] = authJson['http-basic'] || {};
        authJson['http-basic'][resolvedHost] = { username, password };
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

  const { allowScripts, cacheDir: adminCacheDir } = getAdminConfig();
  const cacheDir =
    process.env.COMPOSER_CACHE_DIR ||
    upath.join(adminCacheDir, './others/composer');
  await ensureDir(cacheDir);
  logger.debug(`Using composer cache ${cacheDir}`);

  const lockFileName = packageFileName.replace(/\.json$/, '.lock');
  const existingLockFileContent = await readLocalFile(lockFileName);
  if (!existingLockFileContent) {
    logger.debug('No composer.lock found');
    return null;
  }

  const vendorDir = getSiblingFileName(packageFileName, 'vendor');
  const commitVendorFiles = await localPathExists(vendorDir);
  await ensureLocalDir(vendorDir);
  try {
    await writeLocalFile(packageFileName, newPackageFileContent);
    if (config.isLockFileMaintenance) {
      await deleteLocalFile(lockFileName);
    }

    const execOptions: ExecOptions = {
      cwdFile: packageFileName,
      extraEnv: {
        COMPOSER_CACHE_DIR: cacheDir,
        COMPOSER_AUTH: getAuthJson(),
      },
      docker: {
        image: 'composer',
        tagConstraint: getConstraint(config),
        tagScheme: composerVersioningId,
      },
    };
    const cmd = 'composer';
    let args: string;
    if (config.isLockFileMaintenance) {
      args = 'install';
    } else {
      args =
        ('update ' + updatedDeps.map(quote).join(' ')).trim() +
        ' --with-dependencies';
    }
    if (config.composerIgnorePlatformReqs) {
      args += ' --ignore-platform-reqs';
    }
    args += ' --no-ansi --no-interaction';
    if (!allowScripts || config.ignoreScripts) {
      args += ' --no-scripts --no-autoloader';
    }
    logger.debug({ cmd, args }, 'composer command');
    await exec(`${cmd} ${args}`, execOptions);
    const status = await getRepoStatus();
    if (!status.modified.includes(lockFileName)) {
      return null;
    }
    logger.debug('Returning updated composer.lock');
    const res: UpdateArtifactsResult[] = [
      {
        file: {
          name: lockFileName,
          contents: await readLocalFile(lockFileName),
        },
      },
    ];

    if (!commitVendorFiles) {
      return res;
    }

    logger.debug(`Commiting vendor files in ${vendorDir}`);
    for (const f of [...status.modified, ...status.not_added]) {
      if (f.startsWith(vendorDir)) {
        res.push({
          file: {
            name: f,
            contents: await readLocalFile(f),
          },
        });
      }
    }
    for (const f of status.deleted) {
      res.push({
        file: {
          name: '|delete|',
          contents: f,
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
