import { isString } from '@sindresorhus/is';
import semver from 'semver';
import { quote } from 'shlex';
import upath from 'upath';

import { GlobalConfig } from '../../../../config/global.ts';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import { coerceArray } from '../../../../util/array.ts';
import { getEnv } from '../../../../util/env.ts';
import type { ExecOptions } from '../../../../util/exec/types.ts';
import {
  ensureCacheDir,
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../../util/fs/index.ts';
import { withGitEnvironment } from '../../../../util/git/exec.ts';
import { collectFileChanges } from '../../../../util/git/file-changes.ts';
import { getRepoStatus } from '../../../../util/git/index.ts';
import type { FileChange } from '../../../../util/git/types.ts';
import { regEx } from '../../../../util/regex.ts';
import { sanitize } from '../../../../util/sanitize.ts';
import type {
  BranchConfig,
  BranchUpgradeConfig,
} from '../../../../workers/types.ts';
import { getGoEnv } from '../../../datasource/go/env.ts';
import type { ArtifactError } from '../../types.ts';

import { deriveGoToolchainConstraints } from '../artifacts.ts';
import { getGoModulesInTidyOrder } from '../package-tree.ts';
import type { GoModTidyExecutionResult } from './types.ts';

const gitExec = withGitEnvironment(['go']);

function useModcacherw(goVersion: string | undefined): boolean {
  if (!isString(goVersion)) {
    return true;
  }

  return semver.intersects(goVersion, '>=1.14');
}

function getTidyOptions(config: BranchConfig): string {
  let tidyOpts = '';

  if (config.postUpdateOptions?.includes('gomodTidy1.17')) {
    tidyOpts += ' -compat=1.17';
  }

  if (config.postUpdateOptions?.includes('gomodTidyE')) {
    tidyOpts += ' -e';
  }

  return tidyOpts;
}

function shouldRunTidy(
  config: BranchConfig,
  upgrades: BranchUpgradeConfig[],
): boolean {
  const options = coerceArray(config.postUpdateOptions);

  function isMajorGoUpgrade(upgrade: BranchUpgradeConfig): boolean {
    return upgrade.manager === 'gomod' && upgrade.updateType === 'major';
  }

  const isGoMajorUpdate =
    config.updateType === 'major' || upgrades.some(isMajorGoUpgrade);

  const isImportPathUpdateRequired =
    options.includes('gomodUpdateImportPaths') && isGoMajorUpdate;

  const mustSkipGoModTidy =
    isGoMajorUpdate && !options.includes('gomodUpdateImportPaths');

  if (mustSkipGoModTidy) {
    return false;
  }

  return (
    options.includes('gomodTidy') ||
    options.includes('gomodTidy1.17') ||
    options.includes('gomodTidyE') ||
    options.includes('gomodTidyAll') ||
    isImportPathUpdateRequired
  );
}

async function findGoModFile(
  upgrade: BranchUpgradeConfig,
): Promise<string | null> {
  const packageFile = upgrade.packageFile;

  if (!packageFile) {
    return null;
  }

  if (packageFile.endsWith('.mod')) {
    return packageFile;
  }

  return findLocalSiblingOrParent(packageFile, 'go.mod');
}

async function getGoModules(
  config: BranchConfig,
): Promise<Map<string, BranchUpgradeConfig[]>> {
  const modules = new Map<string, BranchUpgradeConfig[]>();

  for (const upgrade of config.upgrades) {
    const goModFile = await findGoModFile(upgrade);

    if (!goModFile) {
      continue;
    }

    const upgrades = coerceArray(modules.get(goModFile));
    upgrades.push(upgrade);
    modules.set(goModFile, upgrades);
  }

  return modules;
}

async function addModuleFiles(
  goModFile: string,
  files: Set<string>,
): Promise<void> {
  files.add(goModFile);
  files.add(goModFile.replace(regEx(/\.mod$/), '.sum'));

  const goWorkFile = await findLocalSiblingOrParent(goModFile, 'go.work');

  if (goWorkFile) {
    files.add(upath.join(upath.dirname(goWorkFile), 'go.work.sum'));
  }
}

async function runTidy(
  goModFile: string,
  config: BranchConfig,
  commands: string[],
): Promise<void> {
  const goModContent = await readLocalFile(goModFile, 'utf8');

  if (!goModContent) {
    return;
  }

  const goConstraints = await deriveGoToolchainConstraints(
    config,
    goModContent,
  );

  const env = getEnv();
  const goEnv = getGoEnv(true);

  const execOptions: ExecOptions = {
    cwdFile: goModFile,
    extraEnv: {
      GOPATH: await ensureCacheDir('go'),
      GOPROXY: goEnv.GOPROXY,
      GOPRIVATE: goEnv.GOPRIVATE,
      GONOPROXY: goEnv.GONOPROXY,
      GONOSUMDB: goEnv.GONOSUMDB,
      GOSUMDB: env.GOSUMDB,
      GOINSECURE: env.GOINSECURE,
      GOFLAGS: useModcacherw(goConstraints) ? '-modcacherw' : null,
      CGO_ENABLED: GlobalConfig.get('binarySource') === 'docker' ? '0' : null,
    },
    docker: {},
    toolConstraints: [
      {
        toolName: 'golang',
        constraint: goConstraints,
      },
    ],
  };

  await gitExec(commands, execOptions);
}

export async function executeGoModTidy(
  config: BranchConfig,
): Promise<GoModTidyExecutionResult> {
  const updatedArtifacts: FileChange[] = [];
  const artifactErrors: ArtifactError[] = [];
  const filesToCollect = new Set<string>();

  const options = coerceArray(config.postUpdateOptions);

  const isTidyAllRequired = options.includes('gomodTidyAll');
  const tidyOpts = getTidyOptions(config);

  const goModules = await getGoModules(config);

  if (goModules.size === 0) {
    logger.debug('No Go modules found for post-update tidy');
    return { updatedArtifacts, artifactErrors };
  }

  const modulesToTidy: string[] = [];

  for (const [goModFile, upgrades] of goModules) {
    if (!shouldRunTidy(config, upgrades)) {
      logger.debug({ goModFile }, 'Skipping go mod tidy for this module');
      continue;
    }

    const sumFile = goModFile.replace(regEx(/\.mod$/), '.sum');
    const existingGoSum = await readLocalFile(sumFile);

    if (!existingGoSum) {
      logger.debug({ sumFile }, 'No go.sum found, skipping go mod tidy');
      continue;
    }

    modulesToTidy.push(goModFile);
    await addModuleFiles(goModFile, filesToCollect);
  }

  const primaryModules = new Set(modulesToTidy);
  const alreadyTidyDependentModules = new Set<string>();

  for (const goModFile of modulesToTidy) {
    try {
      logger.debug({ goModFile }, 'Running go mod tidy');

      const goModDir = upath.dirname(goModFile);
      const goModBaseName = upath.basename(goModFile);

      const modFileFlag =
        goModBaseName === 'go.mod' ? '' : ` -modfile=${quote(goModBaseName)}`;

      const tidyCommand = `go mod tidy${modFileFlag}${tidyOpts}`;

      const commands = [tidyCommand, tidyCommand];

      if (isTidyAllRequired) {
        let dependentModules: string[] = [];

        try {
          dependentModules = await getGoModulesInTidyOrder(goModFile);
        } catch (err) {
          logger.warn({ err }, 'Failed to find dependent Go modules');
        }

        for (const dependent of dependentModules) {
          await addModuleFiles(dependent, filesToCollect);

          if (
            primaryModules.has(dependent) ||
            alreadyTidyDependentModules.has(dependent)
          ) {
            continue;
          }

          const relativeDir = upath.relative(
            goModDir,
            upath.dirname(dependent),
          );

          commands.push(`go -C ${quote(relativeDir)} mod tidy${tidyOpts}`);

          alreadyTidyDependentModules.add(dependent);
        }

        logger.debug(
          { dependentModules },
          'Dependent Go module tidy commands included',
        );
      }

      await runTidy(goModFile, config, commands);
    } catch (err) {
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }

      logger.debug({ err, goModFile }, 'Failed to execute go mod tidy');

      artifactErrors.push({
        fileName: goModFile.replace(regEx(/\.mod$/), '.sum'),
        stderr: sanitize(err.message),
      });
    }
  }

  if (filesToCollect.size > 0) {
    const status = await getRepoStatus();

    const changes = await collectFileChanges(status, {
      filter: (file) => filesToCollect.has(file),
    });

    updatedArtifacts.push(...changes);
  }

  return {
    updatedArtifacts,
    artifactErrors,
  };
}
