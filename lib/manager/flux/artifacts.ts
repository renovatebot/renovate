import { logger } from '../../logger';
import { exec } from '../../util/exec';
import type { ExecOptions } from '../../util/exec/types';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { isSystemManifest } from '.';

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  if (!isSystemManifest(packageFileName) || !updatedDeps[0]?.newVersion) {
    return null;
  }
  try {
    logger.debug(`Updating Flux system manifests`);
    const cmd = 'flux install --export';
    const execOptions: ExecOptions = {
      docker: {
        image: 'fluxcd/flux-cli',
        tag: updatedDeps[0].newVersion,
      },
    };
    const result = await exec(cmd, execOptions);

    return [
      {
        file: {
          type: 'addition',
          path: packageFileName,
          contents: result.stdout,
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
