import upath from 'upath';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { readLocalFile, writeLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { getNodeToolConstraint } from './post-update/node-version';
import { processHostRules } from './post-update/rules';
import { lazyLoadPackageJson } from './post-update/utils';
import {
  getNpmrcContent,
  resetNpmrcContent,
  updateNpmrcContent,
} from './utils';

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

  const { currentValue, depName, newVersion } = packageManagerUpdate;

  // Execute 'corepack use' command only if the currentValue already has hash in it
  if (!currentValue || !regEx(versionWithHashRegString).test(currentValue)) {
    return null;
  }

  // write old updates before executing corepack update so that they are not removed from package file
  await writeLocalFile(packageFileName, existingPackageFileContent);

  // Asumming that corepack only needs to modify the package.json file in the root folder
  // As it should not be regular practice to have different package managers in different workspaces
  const pkgFileDir = upath.dirname(packageFileName);
  const { additionalNpmrcContent } = processHostRules();
  const npmrcContent = await getNpmrcContent(pkgFileDir);
  const lazyPkgJson = lazyLoadPackageJson(pkgFileDir);
  const cmd = `corepack use ${depName}@${newVersion}`;

  const nodeConstraints = await getNodeToolConstraint(
    config,
    updatedDeps,
    pkgFileDir,
    lazyPkgJson,
  );

  const execOptions: ExecOptions = {
    cwdFile: packageFileName,
    toolConstraints: [
      nodeConstraints,
      {
        toolName: 'corepack',
        constraint: config.constraints?.corepack,
      },
    ],
    docker: {},
  };

  await updateNpmrcContent(pkgFileDir, npmrcContent, additionalNpmrcContent);
  try {
    await exec(cmd, execOptions);
    await resetNpmrcContent(pkgFileDir, npmrcContent);
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
    await resetNpmrcContent(pkgFileDir, npmrcContent);
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
