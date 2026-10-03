import { TEMPORARY_ERROR } from '../../../constants/error-messages.ts';
import { logger } from '../../../logger/index.ts';
import type { ToolConstraint } from '../../../util/exec/types.ts';
import {
  getSiblingFileName,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs/index.ts';
import type {
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../types.ts';
import { runPaketUpdate } from './tool.ts';
import type { PaketManagerData, UpdatePackage } from './types.ts';

const updateAllPackages: UpdatePackage[] = [{}];

function buildUpdateCommands(
  updatedDeps: Upgrade<PaketManagerData>[],
): UpdatePackage[] {
  const commands: UpdatePackage[] = [];
  for (const dep of updatedDeps) {
    if (!dep.depName || !dep.newVersion) {
      logger.debug(
        `Missing depName (${dep.depName}) or newVersion (${dep.newVersion}), skipping paket update for this dependency`,
      );
      continue;
    }

    commands.push({
      packageName: dep.depName,
      version: dep.newVersion,
      group: dep.managerData?.group,
    });
  }

  return commands;
}

export async function updateArtifacts(
  updateArtifact: UpdateArtifact<PaketManagerData>,
): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`paket.updateArtifacts(${updateArtifact.packageFileName})`);

  const lockFileName = getSiblingFileName(
    updateArtifact.packageFileName,
    'paket.lock',
  );
  const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
  if (!existingLockFileContent) {
    logger.debug(`No ${lockFileName} found - returning null`);
    return null;
  }

  if (
    !updateArtifact.config.isLockFileMaintenance &&
    !updateArtifact.updatedDeps.length
  ) {
    logger.debug('No updated paket deps - returning null');
    return null;
  }

  const commands = updateArtifact.config.isLockFileMaintenance
    ? updateAllPackages
    : buildUpdateCommands(updateArtifact.updatedDeps);
  if (!commands.length) {
    logger.debug('No paket update commands to run - returning null');
    return null;
  }

  const toolConstraints: ToolConstraint[] = [
    {
      toolName: 'dotnet',
      constraint: updateArtifact.config.constraints?.dotnet,
    },
    {
      toolName: 'paket',
      constraint: updateArtifact.config.constraints?.paket,
    },
  ];

  try {
    await writeLocalFile(
      updateArtifact.packageFileName,
      updateArtifact.newPackageFileContent,
    );

    await runPaketUpdate(lockFileName, commands, toolConstraints);

    const newLockFileContent = await readLocalFile(lockFileName, 'utf8');

    if (existingLockFileContent === newLockFileContent) {
      logger.debug(`Lock file ${lockFileName} is unchanged`);
      return null;
    }

    return [
      {
        file: {
          type: 'addition',
          path: lockFileName,
          contents: newLockFileContent,
        },
      },
    ];
  } catch (err) {
    if (err.message === TEMPORARY_ERROR) {
      throw err;
    }
    logger.debug({ err }, 'Failed to generate lock file');
    return [
      {
        artifactError: {
          fileName: lockFileName,
          // error is written to stdout
          stderr: err.stdout ?? err.message,
        },
      },
    ];
  }
}
