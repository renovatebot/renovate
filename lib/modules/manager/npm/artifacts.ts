import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import { ExecOptions } from '../../../util/exec/types';
import { readLocalFile } from '../../../util/fs';
import { UpdateArtifact, UpdateArtifactsResult } from '../types';

// used to add the digest recommened by corepack
// since the digest is generated and added by corepack itself and cannot be fecthed from any npm regsitry
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

  // this adds a lockfile if not present
  // but I have not added that to the list of changed files
  // will that suffice, or should I do a proper cleanup so that it does not create problems with other updates
  let cmd = `corepack use `;

  const { depName, newVersion } = packageManagerUpdate;

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
    // eslint-disable-next-line
    console.log('exec start', packageFileName);
    await exec(cmd, execOptions);
    // eslint-disable-next-line
    console.log('exec done');
    // eslint-disable-next-line
    console.log('update file reading start', packageFileName);
    const newPackageFileContent = await readLocalFile(packageFileName, 'utf8');
    // eslint-disable-next-line
    console.log('update file reading done', packageFileName);
    if (
      !newPackageFileContent ||
      existingPackageFileContent === newPackageFileContent
    ) {
      return null;
    }
    logger.debug('Returning updated package.json');
    // eslint-disable-next-line
    console.log({
      type: 'addition',
      path: packageFileName,
      contents: newPackageFileContent,
    });
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
          lockFile: packageFileName,
          stderr: err.message,
        },
      },
    ];
  }
}
