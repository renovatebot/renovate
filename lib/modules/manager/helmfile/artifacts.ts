import { isFalsy } from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import { coerceArray } from '../../../util/array.ts';
import { exec } from '../../../util/exec/index.ts';
import type { ToolConstraint } from '../../../util/exec/types.ts';
import { getSiblingFileName } from '../../../util/fs/index.ts';
import { getFile } from '../../../util/git/index.ts';
import { Result } from '../../../util/result.ts';
import { parseYaml } from '../../../util/yaml.ts';
import {
  findHelmRepositoryCredentials,
  generateHelmEnvs,
  generateRegistryLoginCmd,
} from '../helmv3/common.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';
import {
  artifactErrorResult,
  resolveToolConstraint,
  updateLockFile,
} from '../util.ts';
import { Doc, LockVersion } from './schema.ts';
import type { HelmfileManagerData } from './types.ts';
import { isOciRepositoryFlagSet } from './utils.ts';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config,
}: UpdateArtifact<HelmfileManagerData>): Promise<
  UpdateArtifactsResult[] | null
> {
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
    const helmConstraint = await resolveToolConstraint(config, 'helm');
    const toolConstraints: ToolConstraint[] = [
      {
        toolName: 'helm',
        constraint: helmConstraint,
      },
      {
        toolName: 'helmfile',
        constraint: await resolveToolConstraint(config, 'helmfile', () =>
          Result.parse(existingLockFileContent, LockVersion).unwrapOrNull(),
        ),
      },
    ];
    const needKustomize = updatedDeps.some(
      (dep) => dep.managerData?.needKustomize,
    );
    if (needKustomize) {
      toolConstraints.push({
        toolName: 'kustomize',
        constraint: await resolveToolConstraint(config, 'kustomize'),
      });
    }

    const cmd: string[] = [];
    const docs = parseYaml(newPackageFileContent, {
      removeTemplates: true,
      customSchema: Doc,
      failureBehaviour: 'filter',
    });

    for (const doc of docs) {
      for (const value of coerceArray(doc.repositories).filter(
        isOciRepositoryFlagSet,
      )) {
        const loginCmd = await generateRegistryLoginCmd(value.name, value.url);

        // v8 ignore else -- needs a repository the login helper cannot handle
        if (loginCmd) {
          cmd.push(loginCmd);
        }
      }
    }

    const repositoryCredentialEnvs = Object.fromEntries(
      docs.flatMap((doc) =>
        coerceArray(doc.repositories)
          .filter((value) => !isOciRepositoryFlagSet(value))
          .flatMap((value) => {
            const credentials = findHelmRepositoryCredentials(value.url);
            const envName = value.name.toUpperCase().replaceAll('-', '_');
            return credentials
              ? [
                  [`${envName}_USERNAME`, credentials.username],
                  [`${envName}_PASSWORD`, credentials.password],
                ]
              : [];
          }),
      ),
    );

    cmd.push(`helmfile deps -f ${quote(packageFileName)}`);

    return await updateLockFile({
      lockFileName,
      existingLockFileContent,
      packageFile: { path: packageFileName, contents: newPackageFileContent },
      run: () =>
        exec(cmd, {
          docker: {},
          extraEnv: {
            ...generateHelmEnvs(helmConstraint),
            ...repositoryCredentialEnvs,
          },
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
