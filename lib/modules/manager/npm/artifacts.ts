import semver from 'semver';
import upath from 'upath';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import {
  ensureCacheDir,
  readLocalFile,
  writeLocalFile,
} from '../../../util/fs';
import { newlineRegex, regEx } from '../../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult, Upgrade } from '../types';
import { PNPM_CACHE_DIR, PNPM_STORE_DIR } from './constants';
import { getNodeToolConstraint } from './post-update/node-version';
import { processHostRules } from './post-update/rules';
import { lazyLoadPackageJson } from './post-update/utils';
import { updateDependency } from './update/dependency';
import {
  getNpmrcContent,
  resetNpmrcContent,
  updateNpmrcContent,
} from './utils';

// eg. 8.15.5+sha256.4b4efa12490e5055d59b9b9fc9438b7d581a6b7af3b5675eb5c5f447cee1a589
const versionWithHashRegString = '^(?<version>.*)\\+(?<hash>.*)';

/**
 * Reads Node.js version from .nvmrc or .node-version file
 */
async function getNodeVersionFromFile(
  filename: string,
): Promise<string | null> {
  try {
    const content = await readLocalFile(filename, 'utf8');
    if (!content) {
      return null;
    }
    const version = content
      .split(newlineRegex)[0]
      .trim()
      .replace(regEx(/^v/), '');
    if (semver.valid(version) || semver.validRange(version)) {
      logger.debug(`Found Node.js version "${version}" in ${filename}`);
      return version;
    }
  } catch {
    // File doesn't exist or can't be read
  }
  return null;
}

/**
 * Gets the Node.js version from .nvmrc or .node-version files in the given directory
 */
async function getNodeVersionFromFiles(
  directory: string,
): Promise<string | null> {
  const nvmrcPath = upath.join(directory, '.nvmrc');
  const nodeVersionPath = upath.join(directory, '.node-version');

  // Try .nvmrc first, then .node-version
  const version =
    (await getNodeVersionFromFile(nvmrcPath)) ??
    (await getNodeVersionFromFile(nodeVersionPath));

  return version;
}

/**
 * Preserves the constraint format (>=, ^, etc.) when updating engines.node
 * If current value has a constraint prefix, apply it to the new version
 */
function preserveConstraintFormat(
  currentValue: string,
  newVersion: string,
): string {
  // If current value is already a range, try to preserve the format
  if (semver.validRange(currentValue) && !semver.valid(currentValue)) {
    // Extract the constraint operator (>=, ^, ~, etc.)
    const constraintMatch = regEx(/^([>=^~<]+)/).exec(currentValue);
    if (constraintMatch) {
      const operator = constraintMatch[1];
      // For exact versions, use >= to ensure minimum version
      if (semver.valid(newVersion)) {
        if (operator.startsWith('>=')) {
          return `${operator}${newVersion}`;
        }
        // For other operators, use >= as a safe default
        return `>=${newVersion}`;
      }
      return `${operator}${newVersion}`;
    }
  }

  // If newVersion is a valid version (not a range), use >= as default
  if (semver.valid(newVersion)) {
    return `>=${newVersion}`;
  }

  // Otherwise, use the newVersion as-is (it might already be a range)
  return newVersion;
}

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

  const pkgFileDir = upath.dirname(packageFileName);
  let updatedContent = existingPackageFileContent;
  let hasUpdates = false;

  // Check for packageManager updates
  const packageManagerUpdate = updatedDeps.find(
    (dep) => dep.depType === 'packageManager',
  );

  if (packageManagerUpdate) {
    const { currentValue, depName, newVersion } = packageManagerUpdate;

    // Execute 'corepack use' command only if the currentValue already has hash in it
    if (currentValue && regEx(versionWithHashRegString).test(currentValue)) {
      // write old updates before executing corepack update so that they are not removed from package file
      await writeLocalFile(packageFileName, existingPackageFileContent);

      // Asumming that corepack only needs to modify the package.json file in the root folder
      // As it should not be regular practice to have different package managers in different workspaces
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

      const pnpmConfigCacheDir = await ensureCacheDir(PNPM_CACHE_DIR);
      const pnpmConfigStoreDir = await ensureCacheDir(PNPM_STORE_DIR);
      const execOptions: ExecOptions = {
        cwdFile: packageFileName,
        extraEnv: {
          // To make sure pnpm store location is consistent between "corepack use"
          // here and the pnpm commands in ./post-update/pnpm.ts. Check
          // ./post-update/pnpm.ts for more details.
          npm_config_cache_dir: pnpmConfigCacheDir,
          npm_config_store_dir: pnpmConfigStoreDir,
          pnpm_config_cache_dir: pnpmConfigCacheDir,
          pnpm_config_store_dir: pnpmConfigStoreDir,
        },
        toolConstraints: [
          nodeConstraints,
          {
            toolName: 'corepack',
            constraint: config.constraints?.corepack,
          },
        ],
        docker: {},
      };

      await updateNpmrcContent(
        pkgFileDir,
        npmrcContent,
        additionalNpmrcContent,
      );
      try {
        await exec(cmd, execOptions);
        await resetNpmrcContent(pkgFileDir, npmrcContent);
        const corepackUpdatedContent = await readLocalFile(
          packageFileName,
          'utf8',
        );
        if (corepackUpdatedContent) {
          updatedContent = corepackUpdatedContent;
          hasUpdates = true;
        }
      } catch (err) {
        logger.warn({ err }, 'Error updating package.json with corepack');
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
  }

  // Check for Node.js updates from .nvmrc or .node-version files
  // and update engines.node in package.json if needed
  try {
    const nodeVersionFromFiles = await getNodeVersionFromFiles(pkgFileDir);
    if (nodeVersionFromFiles) {
      const packageJson = JSON.parse(updatedContent);
      const currentEnginesNode = packageJson.engines?.node;

      if (currentEnginesNode) {
        // Check if the version from files differs from engines.node
        // Extract the base version from the current constraint for comparison
        const currentVersion = semver.valid(currentEnginesNode)
          ? currentEnginesNode
          : semver.coerce(currentEnginesNode)?.version;
        const fileVersion = semver.valid(nodeVersionFromFiles)
          ? nodeVersionFromFiles
          : semver.coerce(nodeVersionFromFiles)?.version;

        if (
          currentVersion &&
          fileVersion &&
          currentVersion !== fileVersion &&
          semver.gte(fileVersion, currentVersion)
        ) {
          // Update engines.node to match the version from .nvmrc/.node-version
          const newEnginesNodeValue = preserveConstraintFormat(
            currentEnginesNode,
            nodeVersionFromFiles,
          );

          logger.debug(
            `Updating engines.node from "${currentEnginesNode}" to "${newEnginesNodeValue}" based on Node.js file version`,
          );

          const nodeUpdate: Upgrade = {
            depName: 'node',
            depType: 'engines',
            managerData: { key: 'node' },
            newValue: newEnginesNodeValue,
            currentValue: currentEnginesNode,
          };

          const updatedPackageJson = updateDependency({
            fileContent: updatedContent,
            upgrade: nodeUpdate,
          });

          if (updatedPackageJson && updatedPackageJson !== updatedContent) {
            updatedContent = updatedPackageJson;
            hasUpdates = true;
          }
        }
      }
    }
  } catch (err) {
    // Log but don't fail - this is a nice-to-have feature
    logger.debug(
      { err, packageFileName },
      'Error checking for Node.js version updates in engines.node',
    );
  }

  if (!hasUpdates) {
    return null;
  }

  if (updatedContent === existingPackageFileContent) {
    return null;
  }

  logger.debug('Returning updated package.json');
  return [
    {
      file: {
        type: 'addition',
        path: packageFileName,
        contents: updatedContent,
      },
    },
  ];
}
