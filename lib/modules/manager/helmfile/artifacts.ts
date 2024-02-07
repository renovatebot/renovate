import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { coerceArray } from '../../../util/array';
import { exec } from '../../../util/exec';
import type { ToolConstraint } from '../../../util/exec/types';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { getFile } from '../../../util/git';
import { regEx } from '../../../util/regex';
import { Result } from '../../../util/result';
import { Yaml } from '../../../util/schema-utils';
import { generateHelmEnvs } from '../helmv3/common';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { Doc, LockVersion } from './schema';
import { generateRegistryLoginCmd, isOCIRegistry } from './utils';

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
        constraint:
          config.constraints?.helmfile ??
          Result.parse(existingLockFileContent, LockVersion).unwrapOrNull(),
      },
    ];
    const needKustomize = updatedDeps.some(
      (dep) => dep.managerData?.needKustomize,
    );
    if (needKustomize) {
      toolConstraints.push({
        toolName: 'kustomize',
        constraint: config.constraints?.kustomize,
      });
    }

    const cmd: string[] = [];
    const doc = Result.parse(
      newPackageFileContent,
      Yaml.pipe(Doc),
    ).unwrapOrThrow();

    for (const value of coerceArray(doc.repositories).filter(isOCIRegistry)) {
      const loginCmd = await generateRegistryLoginCmd(
        value.name,
        `https://${value.url}`,
        // this extracts the hostname from url like format ghcr.ip/helm-charts
        value.url.replace(regEx(/\/.*/), ''),
      );

      if (loginCmd) {
        cmd.push(loginCmd);
      }
    }

    cmd.push(`helmfile deps -f ${quote(packageFileName)}`);
    await exec(cmd, {
      docker: {},
      extraEnv: generateHelmEnvs(),
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
