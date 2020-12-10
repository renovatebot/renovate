import { Release } from '../../datasource';
import * as githubReleases from '../../datasource/github-releases';
import { logger } from '../../logger';
import { Http } from '../../util/http';
import { UpdateArtifact, UpdateArtifactsResult } from '../common';

const http = new Http('batect-wrapper');

async function getReleaseDetails(version: string): Promise<Release> {
  const { releases } = await githubReleases.getReleases({
    registryUrl: 'https://github.com/',
    lookupName: 'batect/batect',
  });

  const matchingReleases = releases.filter((r) => r.version === version);

  if (matchingReleases.length !== 1) {
    throw new Error(
      `Found ${matchingReleases.length} releases of Batect for version ${version}`
    );
  }

  return matchingReleases[0];
}

async function getFileContent(
  release: Release,
  fileName: string
): Promise<string> {
  const files = release.files.filter((f) => f.name === fileName);

  if (files.length !== 1) {
    throw new Error(
      `Batect release ${release.version} contains ${files.length} files with name ${fileName}`
    );
  }

  const response = await http.get(files[0].url);

  return response.body;
}

export async function updateArtifacts({
  packageFileName,
  updatedDeps,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(
    { version: config.toVersion, packageFileName },
    'Updating Batect wrapper scripts'
  );

  const release = await getReleaseDetails(config.toVersion);

  return [
    {
      file: {
        name: packageFileName,
        contents: await getFileContent(release, 'batect'),
      },
    },
    {
      file: {
        name: `${packageFileName}.cmd`,
        contents: await getFileContent(release, 'batect.cmd'),
      },
    },
  ];
}
