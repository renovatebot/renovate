import is from '@sindresorhus/is';
import yaml from 'js-yaml';
import { quote } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ToolConstraint } from '../../../util/exec/types';
import {
  getSiblingFileName,
  privateCacheDir,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getFile } from '../../../util/git';
import * as hostRules from '../../../util/host-rules';
import { DockerDatasource } from '../../datasource/docker';
import type { Doc, RepositoryRule } from './types';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import {
  getRepositories,
  isOCIRegistry,
} from './utils';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.trace(`helmfile.updateArtifacts(${packageFileName})`);

  const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';
  if (
    !isLockFileMaintenance &&
    (updatedDeps === undefined || updatedDeps.length < 1)
  ) {
    logger.debug('No updated helmfile deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'helmfile.lock');
  const existingLockFileContent = await getFile(lockFileName);

  if (is.falsy(existingLockFileContent)) {
    logger.debug('No helmfile.lock found');
    return null;
  }

  try {
    await writeLocalFile(packageFileName, newPackageFileContent);

    const toolConstraints: ToolConstraint[] = [
      {
        toolName: 'helm',
        constraint: config.constraints?.helm,
      },
      {
        toolName: 'helmfile',
        constraint: config.constraints?.helmfile,
      },
    ];
    const needKustomize = updatedDeps.some(
      (dep) => dep.managerData?.needKustomize
    );
    if (needKustomize) {
      toolConstraints.push({
        toolName: 'kustomize',
        constraint: config.constraints?.kustomize,
      });
    }

    const cmd: string[] = [];
    // set cache and config files to a path in privateCacheDir to prevent file and credential leakage
    const helmConfigParameters = [
      `--registry-config ${upath.join(privateCacheDir(), 'registry.json')}`,
      `--repository-config ${upath.join(privateCacheDir(), 'repositories.yaml')}`,
      `--repository-cache ${upath.join(privateCacheDir(), 'repositories')}`,
    ];
    const doc = yaml.load(newPackageFileContent) as Doc; //TODO #9610
    const ociRepositoryRules: RepositoryRule[] = getRepositories(doc)
      .filter(isOCIRegistry)
      .map((value) => {
        return {
          ...value,
          hostRule: hostRules.find({
            url: 'https://' + value.url,
            hostType: DockerDatasource.id,
          }),
        };
    });

    const regexOfURLPath = /\/.*/;
    ociRepositoryRules.forEach((value) => {
      const { username, password } = value.hostRule;
      const parameters = [...helmConfigParameters];
      if (username && password) {
        parameters.push(`--username ${quote(username)}`);
        parameters.push(`--password ${quote(password)}`);
        const host = value.url.replace(regexOfURLPath, '')

        cmd.push(
          `helm registry login ${parameters.join(' ')} ${host}`
        );
      }
    });

    cmd.push(`helmfile deps -f ${quote(packageFileName)}`)
    await exec(cmd, {
      docker: {},
      extraEnv: {},
      toolConstraints,
    });

    const newHelmLockContent = await readLocalFile(lockFileName, 'utf8');
    if (existingLockFileContent === newHelmLockContent) {
      logger.debug('helmfile.lock is unchanged');
      return null;
    }

    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newHelmLockContent,
        },
      },
    ];
  } catch (err) {
    // istanbul ignore if
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to update Helmfile lock file');
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
