import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import type { ToolConstraint } from '../../../util/exec/types.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import type {
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../types.ts';
import {
  artifactErrorResult,
  resolveToolConstraint,
  updateLockFile,
} from '../util.ts';
import { runPaketUpdate } from './tool.ts';
import type { PaketManagerData, UpdatePackage } from './types.ts';

const updateAllPackages: UpdatePackage[] = [{}];

function buildUpdateCommands(
  updatedDeps: Upgrade<PaketManagerData>[],
): UpdatePackage[] {
  return updatedDeps.flatMap((dep) => {
    if (!dep.depName || !dep.newVersion) {
      logger.debug(
        `Missing depName (${dep.depName}) or newVersion (${dep.newVersion}), skipping paket update for this dependency`,
      );
      return [];
    }

    return [
      {
        packageName: dep.depName,
        version: dep.newVersion,
        group: dep.managerData?.group,
      },
    ];
  });
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact<PaketManagerData>,
): Promise<UpdateArtifactsResult[] | null> {
  const { config, packageFileName, newPackageFileContent, updatedDeps } =
    updateArtifact;
  logger.debug(`paket.updateArtifacts(${packageFileName})`);

  const lockFileName = getSiblingFileName(packageFileName, 'paket.lock');
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug(`No ${lockFileName} found - returning null`);
    return null;
  }

  if (!config.isLockFileMaintenance && !updatedDeps.length) {
    logger.debug('No updated paket deps - returning null');
    return null;
  }

  const commands = config.isLockFileMaintenance
    ? updateAllPackages
    : buildUpdateCommands(updatedDeps);
  if (!commands.length) {
    logger.debug('No paket update commands to run - returning null');
    return null;
  }

  // dotnet is listed first, as paket releases are matched against its resolved version
  const toolConstraints: ToolConstraint[] = [
    {
      toolName: 'dotnet',
      constraint: await resolveToolConstraint(config, 'dotnet'),
    },
    {
      toolName: 'paket',
      constraint: await resolveToolConstraint(config, 'paket'),
    },
  ];

  try {
    return await updateLockFile({
      lockFileName,
      existingLockFileContent,
      packageFile: { path: packageFileName, contents: newPackageFileContent },
      run: () => runPaketUpdate(lockFileName, commands, toolConstraints),
    });
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to generate lock file');
    return artifactErrorResult(lockFileName, err);
  }
}
