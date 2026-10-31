import { isString } from '@sindresorhus/is';
import { quote } from 'shlex';
import upath from 'upath';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import { coerceArray } from '../../../../util/array.ts';
import type {
  ExecOptions,
  ToolConstraint,
} from '../../../../util/exec/types.ts';
import {
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../../util/fs/index.ts';
import { withGitEnvironment } from '../../../../util/git/exec.ts';
import { regEx } from '../../../../util/regex.ts';
import { Result } from '../../../../util/result.ts';
import { parseUrl, stripUrlCredentials } from '../../../../util/url.ts';
import { findPypiIndexCredentials } from '../../../datasource/pypi/host-rules.ts';
import { PypiDatasource } from '../../../datasource/pypi/index.ts';
import type {
  ExtractConfig,
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../../types.ts';
import {
  applyGitSource,
  artifactErrorResult,
  resolveToolConstraint,
  updateLockFile,
} from '../../util.ts';
import {
  type PyProject,
  type UvLockedPackage,
  UvLockfile,
  type UvSource,
} from '../schema.ts';
import type { Pep621ManagerData } from '../types.ts';
import { depTypes } from '../utils.ts';
import { BasePyProjectProcessor } from './abstract.ts';

const uvUpdateCMD = 'uv lock';
const gitExec = withGitEnvironment(['pep621']);

function isUvIndexSource(
  source: UvSource,
): source is Extract<UvSource, { index: string }> {
  return 'index' in source;
}

// The public PyPI index, as recorded in `uv.lock` package sources. Transitive
// deps resolved from it use the datasource default, so no `registryUrls` needed.
const defaultPypiRegistries = new Set([
  'https://pypi.org/simple',
  'https://pypi.org/simple/',
]);

export class UvProcessor extends BasePyProjectProcessor {
  override lockfileName = 'uv.lock';

  process(project: PyProject, deps: PackageDependency[]): PackageDependency[] {
    const uv = project.tool?.uv;
    if (!uv) {
      return deps;
    }

    const hasExplicitDefault = uv.index?.some(
      (index) => index.default && index.explicit,
    );
    const defaultIndex = uv.index?.find(
      (index) => index.default && !index.explicit,
    );
    const implicitIndexUrls = uv.index
      ?.filter((index) => !index.explicit && index.name !== defaultIndex?.name)
      ?.map(({ url }) => url);

    const devDependencies = uv['dev-dependencies'];
    if (devDependencies) {
      deps.push(...devDependencies);
    }

    // https://docs.astral.sh/uv/concepts/dependencies/#dependency-sources
    // Skip sources that do not make sense to handle (e.g. path).
    if (uv.sources || defaultIndex || implicitIndexUrls) {
      for (const dep of deps) {
        /* v8 ignore next -- needs test */
        if (!dep.packageName) {
          continue;
        }

        if (dep.depType === 'requires-python') {
          continue;
        }

        // Using `packageName` as it applies PEP 508 normalization, which is
        // also applied by uv when matching a source to a dependency.
        const depSources = uv.sources?.[dep.packageName];
        if (depSources) {
          // Dependency is pinned to one or more specific sources.
          dep.depType = depTypes.uvSources;
          if (depSources.every(isUvIndexSource)) {
            // Sources referencing an index, possibly disambiguated by
            // environment markers. Any of the indexes can serve the package,
            // so use all of them as registries.
            const registryUrls: string[] = [];
            for (const depSource of depSources) {
              const index = uv.index?.find(
                ({ name }) => name === depSource.index,
              );
              if (index) {
                registryUrls.push(index.url);
              }
            }
            if (registryUrls.length) {
              dep.registryUrls = [...new Set(registryUrls)];
            }
          } else if (depSources.length === 1) {
            const depSource = depSources[0];
            if ('git' in depSource) {
              applyGitSource(
                dep,
                depSource.git,
                depSource.rev,
                depSource.tag,
                depSource.branch,
              );
            } else if ('url' in depSource) {
              dep.skipReason = 'unsupported-url';
            } else if ('path' in depSource) {
              dep.skipReason = 'path-dependency';
            } else if ('workspace' in depSource) {
              dep.skipReason = 'inherited-dependency';
            } else {
              dep.skipReason = 'unknown-registry';
            }
          } else {
            // Multiple sources that are not all indexes (e.g. a git source
            // per platform) cannot be represented as a single update.
            dep.skipReason = 'unsupported';
          }
        } else {
          // Dependency is not pinned to a specific source, so we need to
          // determine the source based on the index configuration.
          if (hasExplicitDefault) {
            // don't fall back to pypi if there is an explicit default index
            dep.registryUrls = [];
          } else if (defaultIndex) {
            // There is a default index configured, so use it.
            dep.registryUrls = [defaultIndex.url];
          }

          if (implicitIndexUrls?.length) {
            // If there are implicit indexes, check them first and fall back
            // to the default.
            dep.registryUrls = implicitIndexUrls.concat(
              dep.registryUrls ?? PypiDatasource.defaultURL,
            );
          }
        }
      }
    }

    return deps;
  }

  async extractLockedVersions(
    project: PyProject,
    deps: PackageDependency[],
    packageFile: string,
    config?: ExtractConfig,
  ): Promise<PackageDependency[]> {
    const lockFileName = await findLocalSiblingOrParent(
      packageFile,
      this.lockfileName,
    );
    if (lockFileName === null) {
      logger.debug({ packageFile }, `No uv lock file found`);
    } else {
      const lockFileContent = await readLocalFile(lockFileName, 'utf8');
      if (lockFileContent) {
        const { val: lockFileMapping, err } = Result.parse(
          lockFileContent,
          UvLockfile,
        ).unwrap();

        if (err) {
          logger.debug({ packageFile, err }, `Error parsing uv lock file`);
        } else {
          const { packages, declaredNames } = lockFileMapping;
          for (const dep of deps as PackageDependency<Pep621ManagerData>[]) {
            const packageName = dep.packageName;
            if (packageName && packageName in packages) {
              const locked = packages[packageName];
              dep.lockedVersion = locked.version;
              if (locked.hasMultipleEntries) {
                dep.managerData = {
                  ...dep.managerData,
                  hasMultipleLockedEntries: true,
                };
              }
            }
          }

          // Transitive dependencies are only of use to vulnerability
          // remediation, and a large `uv.lock` holds a lot of them, so don't
          // surface any unless vulnerability alerts are enabled.
          //
          // A workspace shares one lock file between its members, so they are
          // surfaced once, for the package file which owns it, or every member
          // would report the others' dependencies as transitive.
          if (
            config?.hasVulnerabilityAlertsRules &&
            upath.dirname(lockFileName) === upath.dirname(packageFile)
          ) {
            this.addTransitiveDeps(deps, packages, declaredNames);
          }
        }
      }
    }

    return Promise.resolve(deps);
  }

  /**
   * Appends the packages which only exist in `uv.lock` to the given dependencies.
   *
   * They are skipped, so they produce no routine updates, but
   * vulnerability alerts can still match them and clear the skip to get a
   * targeted `uv lock --upgrade-package` when a fixed version exists.
   */
  private addTransitiveDeps(
    deps: PackageDependency[],
    packages: Record<string, UvLockedPackage>,
    declaredNames: ReadonlySet<string>,
  ): void {
    const declaredPackageNames = new Set([
      ...declaredNames,
      ...deps.map((dep) => dep.packageName).filter(isString),
    ]);

    for (const [packageName, locked] of Object.entries(packages)) {
      if (declaredPackageNames.has(packageName)) {
        continue;
      }
      // Only registry-sourced packages can be remediated by name. Skip the
      // workspace root and any virtual/editable/path/git packages.
      if (!locked.registryUrl) {
        continue;
      }
      const transitiveDep: PackageDependency = {
        packageName,
        depName: packageName,
        depType: depTypes.uvTransitiveDependencies,
        datasource: PypiDatasource.id,
        lockedVersion: locked.version,
        skipReason: 'lockfile-only',
        skipStage: 'extract',
      };
      if (locked.hasMultipleEntries) {
        transitiveDep.managerData = { hasMultipleLockedEntries: true };
      }
      if (!defaultPypiRegistries.has(locked.registryUrl)) {
        transitiveDep.registryUrls = [locked.registryUrl];
      }
      deps.push(transitiveDep);
    }
  }

  async updateArtifacts(
    updateArtifact: UpdateArtifact<Pep621ManagerData>,
    project: PyProject,
  ): Promise<UpdateArtifactsResult[] | null> {
    const { config, updatedDeps, packageFileName } = updateArtifact;

    const { isLockFileMaintenance } = config;

    // abort if no lockfile is defined
    const lockFileName = await findLocalSiblingOrParent(
      packageFileName,
      'uv.lock',
    );
    if (lockFileName === null) {
      logger.debug({ packageFileName }, `No uv lock file found`);
      return null;
    }
    try {
      const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
      if (!existingLockFileContent) {
        logger.debug('No uv.lock found');
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
      const uvConstraint: ToolConstraint = {
        toolName: 'uv',
        constraint: await resolveToolConstraint(
          config,
          'uv',
          () => project.tool?.uv?.['required-version'],
        ),
      };

      const extraEnv = {
        ...(await getUvExtraIndexUrl(project, updateArtifact.updatedDeps)),
        ...(await getUvIndexCredentials(project)),
      };
      const execOptions: ExecOptions = {
        cwdFile: packageFileName,
        extraEnv,
        docker: {},
        toolConstraints: [pythonConstraint, uvConstraint],
      };

      // on lockFileMaintenance do not specify any packages and update the complete lock file
      // else only update specific packages
      let cmd: string;
      if (isLockFileMaintenance) {
        cmd = `${uvUpdateCMD} --upgrade`;
      } else {
        cmd = generateCMD(updatedDeps);
      }
      return await updateLockFile({
        lockFileName,
        existingLockFileContent,
        run: () => gitExec(cmd, execOptions),
      });
    } catch (err) {
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.debug({ err }, 'Failed to update uv lock file');
      return artifactErrorResult(lockFileName, err);
    }
  }
}

/**
 * The `--upgrade-package` argument to move `dep` to the version which was
 * looked up, or to whichever version `uv` resolves when it cannot be pinned.
 */
function pinnedUpgrade(dep: Upgrade<Pep621ManagerData>): string {
  // A package the lock file holds more than once, e.g. at a version per
  // resolution marker, can only be upgraded without a version: `uv` reads a
  // pinned one as a constraint on every marker, so it would downgrade the
  // other entries, or fail to resolve at all.
  if (dep.managerData?.hasMultipleLockedEntries) {
    logger.warn(
      { packageName: dep.packageName, newVersion: dep.newVersion },
      'Upgrading a dependency which the lock file holds more than once, without a version: vulnerabilityFixStrategy cannot be honoured, so the version this resolves to may differ from the one Renovate picked',
    );
    return dep.packageName!;
  }

  return dep.newVersion
    ? `${dep.packageName!}==${dep.newVersion}`
    : dep.packageName!;
}

function generateCMD(updatedDeps: Upgrade<Pep621ManagerData>[]): string {
  const deps: string[] = [];

  for (const dep of updatedDeps) {
    switch (dep.depType) {
      case depTypes.optionalDependencies: {
        deps.push(dep.depName!);
        break;
      }
      case depTypes.uvDevDependencies:
      case depTypes.uvSources: {
        deps.push(dep.depName!);
        break;
      }
      case depTypes.uvTransitiveDependencies: {
        // Nothing in `pyproject.toml` constrains a transitive dependency, so an
        // unpinned upgrade would resolve to the newest release instead of the
        // version we determined, e.g. the lowest one fixing a vulnerability.
        deps.push(pinnedUpgrade(dep));
        break;
      }
      case depTypes.buildSystemRequires:
        // A build requirement is not locked, unless something depends on it at
        // runtime as well, in which case the lock holds a version to update.
        if (dep.lockedVersion) {
          deps.push(pinnedUpgrade(dep));
        }
        break;
      default: {
        deps.push(dep.packageName!);
      }
    }
  }

  return `${uvUpdateCMD} ${deps.map((dep) => `--upgrade-package ${quote(dep)}`).join(' ')}`;
}

/**
 * Returns `url` without its userinfo, placeholders included, or `url` unchanged when it cannot be parsed.
 */
function withoutAnyUserinfo(url: string): string {
  return stripUrlCredentials(url) ?? url;
}

async function getUvExtraIndexUrl(
  project: PyProject,
  deps: Upgrade[],
): Promise<NodeJS.ProcessEnv> {
  // compared without any userinfo, which the registry URLs of the deps may no longer carry
  const configuredIndexUrls = new Set(
    coerceArray(project.tool?.uv?.index).map(({ url }) =>
      withoutAnyUserinfo(url),
    ),
  );
  const pyPiRegistryUrls = deps
    .filter((dep) => dep.datasource === PypiDatasource.id)
    .filter((dep) => {
      // Remove dependencies that are pinned to a specific index
      const sources = project.tool?.uv?.sources;
      const packageName = dep.packageName!;
      return !sources || !(packageName in sources);
    })
    .flatMap((dep) => dep.registryUrls)
    .filter(isString)
    .filter((registryUrl) => {
      // Check if the registry URL is not the default one and not already configured
      return (
        registryUrl !== PypiDatasource.defaultURL &&
        !configuredIndexUrls.has(withoutAnyUserinfo(registryUrl))
      );
    });

  const registryUrls = new Set(pyPiRegistryUrls);
  const extraIndexUrls: string[] = [];

  for (const registryUrl of registryUrls) {
    const parsedUrl = parseUrl(registryUrl);
    if (!parsedUrl) {
      continue;
    }

    const { username, password } = await findPypiIndexCredentials(
      parsedUrl.toString(),
    );
    if (username || password) {
      // v8 ignore else -- needs a host rule carrying only one of the two
      if (username) {
        parsedUrl.username = username;
      }
      // v8 ignore else -- needs a host rule carrying only one of the two
      if (password) {
        parsedUrl.password = password;
      }
    }

    extraIndexUrls.push(parsedUrl.toString());
  }

  return {
    UV_EXTRA_INDEX_URL: extraIndexUrls.join(' '),
  };
}

async function getUvIndexCredentials(
  project: PyProject,
): Promise<NodeJS.ProcessEnv> {
  const uv_indexes = project.tool?.uv?.index;

  if (!uv_indexes) {
    return {};
  }

  const entries = [];

  for (const { name, url } of uv_indexes) {
    const parsedUrl = parseUrl(url);
    /* v8 ignore next -- needs test */
    if (!parsedUrl) {
      continue;
    }

    // If no name is provided for the index, authentication information must be passed through alternative methods
    if (!name) {
      continue;
    }

    const { username, password } = await findPypiIndexCredentials(
      parsedUrl.toString(),
    );

    const NAME = name.toUpperCase().replace(regEx(/[^A-Z0-9]/g), '_');

    // v8 ignore else -- needs a host rule carrying only one of the two
    if (username) {
      entries.push([`UV_INDEX_${NAME}_USERNAME`, username]);
    }

    // v8 ignore else -- needs a host rule carrying only one of the two
    if (password) {
      entries.push([`UV_INDEX_${NAME}_PASSWORD`, password]);
    }
  }

  return Object.fromEntries(entries);
}
