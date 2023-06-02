import is from '@sindresorhus/is';
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
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import {
  generateRegistryLoginCmd,
  getRepositories,
  isOCIRegistry,
  parseDoc,
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
    const doc = parseDoc(newPackageFileContent);

    const regexOfURLPath = /\/.*/;
    getRepositories(doc)
      .filter(isOCIRegistry)
      .forEach((value) => {
        const loginCmd = generateRegistryLoginCmd(
          value.name,
          'https://' + value.url,
          value.url.replace(regexOfURLPath, '')
        );

        if (loginCmd) {
          cmd.push(loginCmd);
        }
      });

    cmd.push(`helmfile deps -f ${quote(packageFileName)}`);
    await exec(cmd, {
      docker: {},
      extraEnv: {
        // set cache and config files to a path in privateCacheDir to prevent file and credential leakage
        HELM_REGISTRY_CONFIG: `${upath.join(
          privateCacheDir(),
          'registry.json'
        )}`,
        HELM_REPOSITORY_CONFIG: `${upath.join(
          privateCacheDir(),
          'repositories.yaml'
        )}`,
        HELM_REPOSITORY_CACHE: `${upath.join(
          privateCacheDir(),
          'repositories'
        )}`,
      },
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
