import { randomUUID } from 'node:crypto';
import { isNonEmptyString } from '@sindresorhus/is';
import semver from 'semver';
import { quote } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import type {
  ExecOptions,
  ToolConstraint,
} from '../../../../util/exec/types.ts';
import {
  getSiblingFileName,
  outputCacheFile,
  privateCacheDir,
  readLocalFile,
  rmCache,
} from '../../../../util/fs/index.ts';
import { withGitEnvironment } from '../../../../util/git/exec.ts';
import { Result } from '../../../../util/result.ts';
import { PypiDatasource } from '../../../datasource/pypi/index.ts';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../../types.ts';
import {
  artifactErrorResult,
  resolveToolConstraint,
  updateLockFile,
} from '../../util.ts';
import { PdmLockfile, type PyProject } from '../schema.ts';
import type { Pep621ManagerData } from '../types.ts';
import { depTypes } from '../utils.ts';
import { BasePyProjectProcessor } from './abstract.ts';

const pdmUpdateCMD = 'pdm update --no-sync --update-eager';
// `pdm update --override` was added in pdm 2.17.0
const overrideMinVersion = '>=2.17.0';
const gitExec = withGitEnvironment(['pep621']);

export class PdmProcessor extends BasePyProjectProcessor {
  override lockfileName = 'pdm.lock';

  process(project: PyProject, deps: PackageDependency[]): PackageDependency[] {
    const devDependencies = project.tool?.pdm?.devDependencies;
    if (devDependencies) {
      deps.push(...devDependencies);
    }

    const registryUrls = project.tool?.pdm?.registryUrls;
    if (registryUrls) {
      for (const dep of deps) {
        if (dep.datasource === PypiDatasource.id) {
          dep.registryUrls = registryUrls;
        }
      }
    }

    return deps;
  }

  async extractLockedVersions(
    project: PyProject,
    deps: PackageDependency<Pep621ManagerData>[],
    packageFile: string,
  ): Promise<PackageDependency[]> {
    if (
      !project.tool?.pdm &&
      project['build-system']?.['build-backend'] !== 'pdm.backend'
    ) {
      return Promise.resolve(deps);
    }

    const lockFileName = getSiblingFileName(packageFile, 'pdm.lock');
    const lockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (lockFileContent) {
      const lockFileMapping = Result.parse(
        lockFileContent,
        PdmLockfile.transform(({ lock }) => lock),
      ).unwrapOr({});

      for (const dep of deps) {
        const packageName = dep.packageName;
        if (packageName && packageName in lockFileMapping) {
          const locked = lockFileMapping[packageName];
          dep.lockedVersion = locked.version;
          if (locked.hasMultipleEntries) {
            dep.managerData = {
              ...dep.managerData,
              hasMultipleLockedEntries: true,
            };
          }
        }
      }
    }

    return Promise.resolve(deps);
  }

  async updateArtifacts(
    updateArtifact: UpdateArtifact<Pep621ManagerData>,
    project: PyProject,
  ): Promise<UpdateArtifactsResult[] | null> {
    const { config, updatedDeps, packageFileName } = updateArtifact;

    const { isLockFileMaintenance } = config;

    // abort if no lockfile is defined
    const lockFileName = getSiblingFileName(packageFileName, this.lockfileName);
    try {
      const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
      if (!existingLockFileContent) {
        logger.debug('No pdm.lock found');
        return null;
      }

      const pythonConstraint: ToolConstraint = {
        toolName: 'python',
        constraint: await resolveToolConstraint(
          config,
          'python',
          () => project.project?.['requires-python'],
        ),
      };
      const pdmConstraint: ToolConstraint = {
        toolName: 'pdm',
        constraint: await resolveToolConstraint(config, 'pdm'),
      };

      const execOptions: ExecOptions = {
        cwdFile: packageFileName,
        docker: {},
        toolConstraints: [pythonConstraint, pdmConstraint],
      };

      // on lockFileMaintenance do not specify any packages and update the complete lock file
      // else only update specific packages
      if (isLockFileMaintenance) {
        return await updateLockFile({
          lockFileName,
          existingLockFileContent,
          run: () => gitExec(pdmUpdateCMD, execOptions),
        });
      }

      const { packagesByCMD, pins } = groupUpdates(updatedDeps);
      let overrideFile: string | null = null;
      if (pins.length) {
        if (supportsOverride(pdmConstraint.constraint)) {
          overrideFile = upath.join(
            privateCacheDir(),
            `pdm-override-${randomUUID()}.txt`,
          );
          await outputCacheFile(overrideFile, `${pins.join('\n')}\n`);
        } else {
          logger.debug(
            { constraint: pdmConstraint.constraint },
            `pdm may not support --override, which needs ${overrideMinVersion}: updating without pinning versions`,
          );
        }
      }
      const cmds = generateCMDs(
        packagesByCMD,
        overrideFile ? `--override ${quote(overrideFile)}` : '',
      );
      try {
        return await updateLockFile({
          lockFileName,
          existingLockFileContent,
          run: () => gitExec(cmds, execOptions),
        });
      } finally {
        if (overrideFile) {
          await rmCache(overrideFile);
        }
      }
    } catch (err) {
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.debug({ err }, 'Failed to update PDM lock file');
      return artifactErrorResult(lockFileName, err);
    }
  }
}

/**
 * Whether `pdm update` of the version selected by `constraint` supports `--override`.
 */
function supportsOverride(constraint: string | null | undefined): boolean {
  if (!constraint) {
    return true;
  }
  const range = semver.validRange(constraint);
  return !!range && semver.subset(range, overrideMinVersion);
}

/**
 * The pip-requirements line which pins `dep` to its new version on a
 * lock-file-only update of a PyPI package which the lock file holds at one
 * version, else `null`.
 */
function getPin(dep: Upgrade<Pep621ManagerData>): string | null {
  // An override applies to every lock target, so it would move the entries
  // of the other targets to the pinned version as well.
  if (dep.managerData?.hasMultipleLockedEntries) {
    return null;
  }
  // The range in `pyproject.toml` still allows newer versions than the one
  // looked up, so an unpinned update would resolve to the newest of them.
  if (
    dep.isLockfileUpdate &&
    dep.datasource === PypiDatasource.id &&
    dep.newVersion
  ) {
    return `${dep.packageName!}==${dep.newVersion}`;
  }
  return null;
}

interface PdmUpdates {
  packagesByCMD: Record<string, string[]>;
  pins: string[];
}

function groupUpdates(updatedDeps: Upgrade<Pep621ManagerData>[]): PdmUpdates {
  const packagesByCMD: Record<string, string[]> = {};
  const pins: string[] = [];
  for (const dep of updatedDeps) {
    switch (dep.depType) {
      case depTypes.optionalDependencies: {
        if (!dep.managerData?.depGroup) {
          logger.once.warn(
            { dep: dep.depName },
            'Unexpected optional dependency without group',
          );
          continue;
        }
        addPackageToCMDRecord(
          { packagesByCMD, pins },
          `-G ${quote(dep.managerData.depGroup)}`,
          dep,
        );
        break;
      }
      case depTypes.dependencyGroups:
      case depTypes.pdmDevDependencies: {
        if (!dep.managerData?.depGroup) {
          logger.once.warn(
            { dep: dep.depName },
            'Unexpected dev dependency without group',
          );
          continue;
        }
        addPackageToCMDRecord(
          { packagesByCMD, pins },
          `-dG ${quote(dep.managerData.depGroup)}`,
          dep,
        );
        break;
      }
      case depTypes.buildSystemRequires:
        // build requirements are not locked in the lock files, no need to update.
        // Reference: https://github.com/pdm-project/pdm/discussions/2869
        break;
      default: {
        addPackageToCMDRecord({ packagesByCMD, pins }, '', dep);
      }
    }
  }

  return { packagesByCMD, pins };
}

/**
 * The `pdm update` commands for `packagesByCMD`, each with `args` after the
 * base command.
 */
function generateCMDs(
  packagesByCMD: Record<string, string[]>,
  args: string,
): string[] {
  return Object.entries(packagesByCMD).map(([groupArgs, packages]) =>
    [pdmUpdateCMD, args, groupArgs, packages.map(quote).join(' ')]
      .filter(isNonEmptyString)
      .join(' '),
  );
}

function addPackageToCMDRecord(
  { packagesByCMD, pins }: PdmUpdates,
  groupArgs: string,
  dep: Upgrade<Pep621ManagerData>,
): void {
  packagesByCMD[groupArgs] ??= [];
  packagesByCMD[groupArgs].push(dep.packageName!);
  const pin = getPin(dep);
  if (pin) {
    pins.push(pin);
  }
}
