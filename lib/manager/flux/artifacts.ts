import { quote } from 'shlex';
import { logger } from '../../logger';
import { exec } from '../../util/exec';
import type { ExecOptions } from '../../util/exec/types';
import { readLocalFile } from '../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { isSystemManifest } from './common';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  if (!isSystemManifest(packageFileName) || !updatedDeps[0]?.newVersion) {
    return null;
  }
  const existingFileContent = await readLocalFile(packageFileName);
  try {
    logger.debug(`Updating Flux system manifests`);
    const cmd = `flux install --export > ${quote(packageFileName)}`;
    const execOptions: ExecOptions = {
      docker: {
        image: 'sidecar',
      },
      toolConstraints: [
        {
          toolName: 'flux',
          constraint: updatedDeps[0].newVersion,
        },
      ],
    };
    const result = await exec(cmd, execOptions);

    const newFileContent = await readLocalFile(packageFileName);
    if (!newFileContent) {
      logger.debug('Cannot read new flux file content');
      return [
        {
          artifactError: {
            lockFile: packageFileName,
            stderr: result.stderr,
          },
        },
      ];
    }
    if (newFileContent === existingFileContent) {
      logger.debug('Flux contents are unchanged');
      return null;
    }

    return [
      {
        file: {
          type: 'addition',
          path: packageFileName,
          contents: newFileContent,
        },
      },
    ];
  } catch (err) {
    logger.debug({ err }, 'Error generating new Flux system manifests');
    return [
      {
        artifactError: {
          lockFile: packageFileName,
          stderr: err.message,
        },
      },
    ];
  }
}
