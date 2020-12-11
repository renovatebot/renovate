import { logger } from '../../logger';
import { Http } from '../../util/http';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';

const http = new Http('batect-wrapper');

async function getFileContent(
  version: string,
  fileName: string
): Promise<string> {
  const url = `https://github.com/batect/batect/releases/download/${version}/${fileName}`;

  try {
    const response = await http.get(url);

    return response.body;
  } catch (err) {
    const errorDescription: string = err.toString();
    throw new Error(`HTTP GET ${url} failed: ${errorDescription}`);
  }
}

export async function updateArtifacts({
  packageFileName,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const version = config.toVersion;

  logger.debug({ version, packageFileName }, 'Updating Batect wrapper scripts');

  return [
    {
      file: {
        name: packageFileName,
        contents: await getFileContent(version, 'batect'),
      },
    },
    {
      file: {
        name: `${packageFileName}.cmd`,
        contents: await getFileContent(version, 'batect.cmd'),
      },
    },
  ];
}
