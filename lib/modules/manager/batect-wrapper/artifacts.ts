import { logger } from '../../../logger/index.ts';
import { Http } from '../../../util/http/index.ts';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types.ts';

const http = new Http('batect-wrapper');

async function updateArtifact(
  path: string,
  fileName: string,
  version: string,
): Promise<UpdateArtifactsResult> {
  const url = `https://github.com/batect/batect/releases/download/${version}/${fileName}`;

  try {
    const response = await http.getText(url);
    const contents = response.body;

    return {
      file: { type: 'addition', path, contents },
    };
  } catch (err) {
    const errorDescription: string = err.toString();

    return {
      artifactError: {
        fileName: path,
        stderr: `HTTP GET ${url} failed: ${errorDescription}`,
      },
    };
  }
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  // A `batect` wrapper script holds a single Batect version, so the update of
  // this package file is always the first one.
  const version = updatedDeps[0].newVersion!;

  logger.debug(
    `Updating Batect wrapper scripts for ${packageFileName} to ${version}`,
  );

  return [
    await updateArtifact(packageFileName, 'batect', version),
    await updateArtifact(`${packageFileName}.cmd`, 'batect.cmd', version),
  ];
}
