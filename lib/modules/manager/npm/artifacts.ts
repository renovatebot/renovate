import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';

// eg. 8.15.5+sha256.4b4efa12490e5055d59b9b9fc9438b7d581a6b7af3b5675eb5c5f447cee1a589
const versionWithHashRegString = '^(?<version>.*)\\+(?<hash>.*)';

// Execute 'corepack use' command for npm manager updates
// This step is necessary because Corepack recommends attaching a hash after the version
// The hash is generated only after running 'corepack use' and cannot be fetched from the npm registry
export async function updateArtifacts({
  packageFileName,
  config,
  updatedDeps,
  newPackageFileContent: existingPackageFileContent,
}: UpdateArtifact): Promise<UpdateArtifactsResult[] | null> {
  logger.debug(`npm.updateArtifacts(${packageFileName})`);
  const packageManagerUpdate = updatedDeps.find(
    (dep) => dep.depType === 'packageManager',
  );

  if (!packageManagerUpdate) {
    logger.debug('No packageManager updates - returning null');
    return null;
  }

  const { currentValue, depName, newVersion, rangeStrategy } =
    packageManagerUpdate;

  // Execute 'corepack use' command only if:
  // 1. The package manager version is pinned in the project, or
  // 2. The package manager version already has a hash appended
  if (
    !currentValue ||
    (rangeStrategy !== 'pin' &&
      !regEx(versionWithHashRegString).test(currentValue))
  ) {
    return null;
  }

  let cmd = `corepack use `;

  cmd += `${depName}@${newVersion}`;

  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    toolConstraints: [
      {
        toolName: 'node',
        constraint: config.constraints?.node,
      },
    ],
    docker: {},
    userConfiguredEnv: config.env,
  };

  try {
    await exec(cmd, execOptions);

    const newPackageFileContent = await readLocalFile(packageFileName, 'utf8');
    if (
      !newPackageFileContent ||
      existingPackageFileContent === newPackageFileContent
    ) {
      return null;
    }
    logger.debug('Returning updated package.json');
    return [
      {
        file: {
          type: 'addition',
          path: packageFileName,
          contents: newPackageFileContent,
        },
      },
    ];
  } catch (err) {
    logger.warn({ err }, 'Error updating package.json');
    return [
      {
        artifactError: {
          fileName: packageFileName,
          stderr: err.message,
        },
      },
    ];
  }
}
