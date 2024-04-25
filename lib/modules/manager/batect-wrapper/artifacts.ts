import { logger } from '../../../logger';
import { Http } from '../../../util/http';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

const http = new Http('batect-wrapper');

async function updateArtifact(
  path: string,
  fileName: string,
  version: string,
): Promise<UpdateArtifactsResult> {
  const url = `https://github.com/batect/batect/releases/download/${version}/${fileName}`;

  try {
    const response = await http.get(url);
    const contents = response.body;

    return {
      file: { type: 'addition', path, contents },
    };
  } catch (err) {
    const errorDescription: string = err.toString();

    return {
      artifactError: {
        lockFile: path,
        stderr: `HTTP GET ${url} failed: ${errorDescription}`,
      },
    };
  }
}

export async function updateArtifacts({
  packageFileName,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const version = config.newVersion!;

  logger.debug(
    `Updating Batect wrapper scripts for ${packageFileName} to ${version}`,
  );

  return [
    await updateArtifact(packageFileName, 'batect', version),
    await updateArtifact(`${packageFileName}.cmd`, 'batect.cmd', version),
  ];
}
