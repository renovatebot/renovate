import { isFalsy } from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ToolConstraint } from '../../../util/exec/types.ts';
import { getSiblingFileName } from '../../../util/fs/index.ts';
import { getFile } from '../../../util/git/index.ts';
import { regEx } from '../../../util/regex.ts';
import { Result } from '../../../util/result.ts';
import { parseYaml } from '../../../util/yaml.ts';
import { generateHelmEnvs } from '../helmv3/common.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import { artifactErrorResult, updateLockFile } from '../util.ts';
import { Doc, LockVersion } from './schema.ts';
import { generateRegistryLoginCmd, isOCIRegistry } from './utils.ts';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.trace(`helmfile.updateArtifacts(${packageFileName})`);

  const { isLockFileMaintenance } = config;
  if (
    !isLockFileMaintenance &&
    (updatedDeps === undefined || updatedDeps.length < 1)
  ) {
    logger.debug('No updated helmfile deps - returning null');
    return null;
  }

  const lockFileName = getSiblingFileName(packageFileName, 'helmfile.lock');
  const existingLockFileContent = await getFile(lockFileName);

  if (isFalsy(existingLockFileContent)) {
    logger.debug('No helmfile.lock found');
    return null;
  }

  try {
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
    const docs = parseYaml(newPackageFileContent, {
      removeTemplates: true,
      customSchema: Doc,
      failureBehaviour: 'filter',
    });

    for (const doc of docs) {
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
    }

    cmd.push(`helmfile deps -f ${quote(packageFileName)}`);

    return await updateLockFile({
      lockFileName,
      existingLockFileContent,
      packageFile: { path: packageFileName, contents: newPackageFileContent },
      run: () =>
        exec(cmd, {
          docker: {},
          extraEnv: generateHelmEnvs(),
          toolConstraints,
        }),
    });
  } catch (err) {
    /* v8 ignore if -- defensive rethrow, not reproduced in the helmfile specs */
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to update Helmfile lock file');
    return artifactErrorResult(lockFileName, err);
  }
}
