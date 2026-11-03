import is from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { getDigest } from '../../datasource/index.ts';
import type {
  ExtractConfig,
  UpdateArtifact,
  UpdateArtifactsResult,
} from '../types.ts';
import { extractPackageFile } from './extract.ts';

/**
 * Re-pin the digests of FROM images whose tag is composed from `ARG`
 * interpolation, e.g. `FROM image:${ARG_A}-${ARG_B}@sha256:...`.
 *
 * Such an image resolves to a value (`a-b`) that is not a contiguous substring
 * of the Dockerfile, because it lives across the `${ARG}` references, so the
 * normal auto-replace flow cannot rewrite the version and leaves the digest
 * pinned to the previous tag once the args are bumped. This runs after the args
 * have been updated, recomposes each such tag from the current arg values, and
 * resolves its digest with the docker datasource, so the digest and the args
 * land in the same branch.
 */
export async function updateArtifacts({
  packageFileName,
  newPackageFileContent,
  config,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  const extractConfig: ExtractConfig = {
    registryAliases: config.registryAliases,
  };
  const extracted = extractPackageFile(
    newPackageFileContent,
    packageFileName,
    extractConfig,
  );
  if (!extracted?.deps?.length) {
    return null;
  }

  let content = newPackageFileContent;
  for (const dep of extracted.deps) {
    // extract marks a FROM whose tag is composed from multiple `${ARG}`s with this
    // skipReason: its version cannot be rewritten in place, so the normal flow leaves
    // the digest pinned to the previous tag. A literal or single-variable tag is not
    // marked and is re-pinned by the normal flow, so it is left alone here.
    if (
      dep.skipReason !== 'contains-variable' ||
      dep.datasource !== DockerDatasource.id ||
      !is.nonEmptyString(dep.packageName) ||
      !is.nonEmptyString(dep.currentValue) ||
      !is.nonEmptyString(dep.currentDigest) ||
      !is.nonEmptyString(dep.replaceString)
    ) {
      continue;
    }

    let newDigest: string | null;
    try {
      newDigest = await getDigest(
        {
          datasource: dep.datasource,
          packageName: dep.packageName,
          registryUrls: dep.registryUrls,
        },
        dep.currentValue,
      );
    } catch (err) {
      logger.debug(
        { err, packageName: dep.packageName, tag: dep.currentValue },
        'Dockerfile: failed to resolve digest for interpolated FROM image',
      );
      return [
        {
          artifactError: {
            fileName: packageFileName,
            stderr: `Failed to resolve digest for ${dep.packageName}:${dep.currentValue}`,
          },
        },
      ];
    }

    if (newDigest && newDigest !== dep.currentDigest) {
      logger.debug(
        {
          packageName: dep.packageName,
          tag: dep.currentValue,
          currentDigest: dep.currentDigest,
          newDigest,
        },
        'Dockerfile: re-pinning digest for interpolated FROM image',
      );
      content = content.replace(
        dep.replaceString,
        dep.replaceString.replace(dep.currentDigest, newDigest),
      );
    }
  }

  if (content === newPackageFileContent) {
    return null;
  }

  return [
    {
      file: {
        type: 'addition',
        path: packageFileName,
        contents: content,
      },
    },
  ];
}
