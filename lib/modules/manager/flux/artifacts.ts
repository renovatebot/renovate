import { quote } from 'shlex';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { readLocalFile } from '../../../util/fs';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { isSystemManifest } from './common';
import type { FluxManagerData } from './types';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
}: UpdateArtifact<FluxManagerData>): Promise<UpdateArtifactsResult[] | null> {
  const systemDep = updatedDeps[0];
  if (!isSystemManifest(packageFileName) || !systemDep?.newVersion) {
    return null;
  }
  const existingFileContent = await readLocalFile(packageFileName);
  try {
    logger.debug(`Updating Flux system manifests`);
    const args: string[] = ['--export'];
    if (systemDep.managerData?.components) {
      args.push('--components', quote(systemDep.managerData.components));
    }
    const cmd = `flux install ${args.join(' ')} > ${quote(packageFileName)}`;
    const execOptions: ExecOptions = {
      docker: {},
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
