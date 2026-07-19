import { isString } from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages.ts';
import { logger } from '../../../../logger/index.ts';
import type { HostRule } from '../../../../types/index.ts';
import { exec } from '../../../../util/exec/index.ts';
import type {
  ExecOptions,
  ToolConstraint,
} from '../../../../util/exec/types.ts';
import {
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../../util/fs/index.ts';
import { getGitEnvironmentVariables } from '../../../../util/git/auth.ts';
import { find } from '../../../../util/host-rules.ts';
import { Result } from '../../../../util/result.ts';
import { parseUrl } from '../../../../util/url.ts';
import { PypiDatasource } from '../../../datasource/pypi/index.ts';
import { getGoogleAuthHostRule } from '../../../datasource/util.ts';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../../types.ts';
import { applyGitSource } from '../../util.ts';
import { type PyProject, type UvConfig, UvLockfile } from '../schema.ts';
import { depTypes } from '../utils.ts';

import { BasePyProjectProcessor } from './abstract.ts';
import {
  type InheritedUvConfig,
  loadInheritedUvConfig,
} from './uv-workspace.ts';

const uvUpdateCMD = 'uv lock';

type UvSources = NonNullable<UvConfig['sources']>;
type UvIndexes = NonNullable<UvConfig['index']>;

/**
 * Combine the member's own `[tool.uv.sources]` with what the workspace root
 * contributes, with member entries winning on key conflicts.
 */
function effectiveSources(
  memberUv: UvConfig | undefined,
  inherited: InheritedUvConfig | null,
): UvSources | undefined {
  if (!memberUv?.sources && !inherited?.sources) {
    return undefined;
  }
  return {
    ...inherited?.sources,
    ...memberUv?.sources,
  };
}

/**
 * Combine the member's own `[[tool.uv.index]]` entries with what the
 * workspace root contributes. Member entries come first and win on name
 * conflict; unnamed indexes (which cannot conflict by name) are kept as-is.
 */
function effectiveIndexes(
  memberUv: UvConfig | undefined,
  inherited: InheritedUvConfig | null,
): UvIndexes | undefined {
  if (!memberUv?.index && !inherited?.indexes) {
    return undefined;
  }
  const memberIndexNames = new Set(
    (memberUv?.index ?? []).map((i) => i.name).filter((n): n is string => !!n),
  );
  return [
    ...(memberUv?.index ?? []),
    ...(inherited?.indexes ?? []).filter(
      (i) => !i.name || !memberIndexNames.has(i.name),
    ),
  ];
}

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
        /* v8 ignore next 3 -- needs test */
        if (!dep.packageName) {
          continue;
        }

        if (dep.depType === 'requires-python') {
          continue;
        }

        // Using `packageName` as it applies PEP 508 normalization, which is
        // also applied by uv when matching a source to a dependency.
        const depSource = uv.sources?.[dep.packageName];
        if (depSource) {
          // Dependency is pinned to a specific source.
          dep.depType = depTypes.uvSources;
          if ('index' in depSource) {
            const index = uv.index?.find(
              ({ name }) => name === depSource.index,
            );
            if (index) {
              dep.registryUrls = [index.url];
            }
          } else if ('git' in depSource) {
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
            /* v8 ignore next -- unreachable through schema */
            dep.skipReason = 'unknown-registry';
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

  /**
   * Apply uv workspace-root inheritance.
   *
   * `process()` runs first and resolves sources/indexes from the member's
   * own `[tool.uv]`. If this pyproject is a uv workspace member, the
   * workspace root contributes additional sources and indexes that the
   * member inherits (with member entries winning on conflict). This method
   * overlays those onto the deps that `process()` already produced.
   *
   * Semantics, per uv's workspace docs:
   * - Member-pinned source for a dep → member wins, untouched here.
   *   Exception: if the member's source references an index by name and
   *   that index lives only at the root, resolve the URL now.
   * - Inherited source for an un-pinned dep → apply the inherited source.
   * - Inherited indexes that the member does not declare → apply their
   *   default / explicit-default / implicit-fallback behavior to deps that
   *   are still un-pinned.
   */
  override async extractWorkspaceContext(
    project: PyProject,
    deps: PackageDependency[],
    packageFile: string,
  ): Promise<PackageDependency[]> {
    const inherited = await loadInheritedUvConfig(packageFile);
    if (!inherited) {
      return deps;
    }

    const memberUv = project.tool?.uv;
    const memberSources = memberUv?.sources;
    const memberIndexes = memberUv?.index ?? [];
    const memberIndexNames = new Set(
      memberIndexes.map((i) => i.name).filter((n): n is string => !!n),
    );
    const memberIndexUrls = new Set(memberIndexes.map((i) => i.url));

    // Indexes from the workspace root that the member doesn't already
    // declare. Member entries with the same name OR URL take precedence.
    const newIndexes = inherited.indexes.filter(
      (i) =>
        (!i.name || !memberIndexNames.has(i.name)) &&
        !memberIndexUrls.has(i.url),
    );

    const memberHasExplicitDefault = memberIndexes.some(
      (i) => i.default && i.explicit,
    );
    const memberHasDefault = memberIndexes.some(
      (i) => i.default && !i.explicit,
    );

    const newHasExplicitDefault = newIndexes.some(
      (i) => i.default && i.explicit,
    );
    const newDefaultIndex = newIndexes.find((i) => i.default && !i.explicit);
    const newImplicitIndexUrls = newIndexes
      .filter((i) => !i.explicit && i.name !== newDefaultIndex?.name)
      .map((i) => i.url);

    for (const dep of deps) {
      /* v8 ignore next 3 -- needs test */
      if (!dep.packageName) {
        continue;
      }
      if (dep.depType === 'requires-python') {
        continue;
      }

      const memberSrc = memberSources?.[dep.packageName];
      if (memberSrc) {
        // Member pinned this dep. If the source references an index by name
        // and `process()` couldn't resolve it (because the index lives at
        // the workspace root), resolve it from the inherited indexes now.
        if (
          'index' in memberSrc &&
          (!dep.registryUrls || dep.registryUrls.length === 0)
        ) {
          const idx = inherited.indexes.find(
            ({ name }) => name === memberSrc.index,
          );
          if (idx) {
            dep.registryUrls = [idx.url];
          }
        }
        continue;
      }

      const inheritedSrc = inherited.sources[dep.packageName];
      if (inheritedSrc) {
        dep.depType = depTypes.uvSources;
        if ('index' in inheritedSrc) {
          const idx =
            memberIndexes.find(({ name }) => name === inheritedSrc.index) ??
            inherited.indexes.find(({ name }) => name === inheritedSrc.index);
          if (idx) {
            dep.registryUrls = [idx.url];
          }
        } else if ('git' in inheritedSrc) {
          applyGitSource(
            dep,
            inheritedSrc.git,
            inheritedSrc.rev,
            inheritedSrc.tag,
            inheritedSrc.branch,
          );
        } else if ('url' in inheritedSrc) {
          dep.skipReason = 'unsupported-url';
        } else if ('path' in inheritedSrc) {
          dep.skipReason = 'path-dependency';
        } else if ('workspace' in inheritedSrc) {
          dep.skipReason = 'inherited-dependency';
        } else {
          /* v8 ignore next -- unreachable through schema */
          dep.skipReason = 'unknown-registry';
        }
        continue;
      }

      // Un-pinned dep: apply incremental effect of inherited indexes.
      if (!memberHasExplicitDefault && !memberHasDefault) {
        if (newHasExplicitDefault) {
          dep.registryUrls = [];
        } else if (newDefaultIndex) {
          dep.registryUrls = [newDefaultIndex.url];
        }
      }
      if (newImplicitIndexUrls.length) {
        dep.registryUrls = newImplicitIndexUrls.concat(
          dep.registryUrls ?? PypiDatasource.defaultURL,
        );
      }
    }

    return deps;
  }

  async extractLockedVersions(
    project: PyProject,
    deps: PackageDependency[],
    packageFile: string,
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
          for (const dep of deps) {
            const packageName = dep.packageName;
            if (packageName && packageName in lockFileMapping) {
              dep.lockedVersion = lockFileMapping[packageName];
            }
          }
        }
      }
    }

    return Promise.resolve(deps);
  }

  async updateArtifacts(
    updateArtifact: UpdateArtifact,
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
        constraint:
          config.constraints?.python ?? project.project?.['requires-python'],
      };
      const uvConstraint: ToolConstraint = {
        toolName: 'uv',
        constraint:
          config.constraints?.uv ?? project.tool?.uv?.['required-version'],
      };

      const memberUv = project.tool?.uv;
      const inherited = await loadInheritedUvConfig(packageFileName);
      const sources = effectiveSources(memberUv, inherited);
      const indexes = effectiveIndexes(memberUv, inherited);

      const extraEnv = {
        ...getGitEnvironmentVariables(['pep621']),
        ...(await getUvExtraIndexUrl(
          sources,
          indexes,
          updateArtifact.updatedDeps,
        )),
        ...(await getUvIndexCredentials(indexes)),
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
      await exec(cmd, execOptions);

      // check for changes
      const fileChanges: UpdateArtifactsResult[] = [];
      const newLockContent = await readLocalFile(lockFileName, 'utf8');
      const isLockFileChanged = existingLockFileContent !== newLockContent;
      if (isLockFileChanged) {
        fileChanges.push({
          file: {
            type: 'addition',
            path: lockFileName,
            contents: newLockContent,
          },
        });
      } else {
        logger.debug('uv.lock is unchanged');
      }

      return fileChanges.length ? fileChanges : null;
    } catch (err) {
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.debug({ err }, 'Failed to update uv lock file');
      return [
        {
          artifactError: {
            fileName: lockFileName,
            stderr: err.message,
          },
        },
      ];
    }
  }
}

function generateCMD(updatedDeps: Upgrade[]): string {
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
      case depTypes.buildSystemRequires:
        // build requirements are not locked in the lock files, no need to update.
        break;
      default: {
        deps.push(dep.packageName!);
      }
    }
  }

  return `${uvUpdateCMD} ${deps.map((dep) => `--upgrade-package ${quote(dep)}`).join(' ')}`;
}

function getMatchingHostRule(url: string | undefined): HostRule {
  return find({ hostType: PypiDatasource.id, url });
}

async function getUsernamePassword(
  url: URL,
): Promise<{ username?: string; password?: string }> {
  const rule = getMatchingHostRule(url.toString());
  if (rule.username || rule.password) {
    return rule;
  }

  if (url.hostname.endsWith('.pkg.dev')) {
    const hostRule = await getGoogleAuthHostRule();
    if (hostRule) {
      return hostRule;
    }
    logger.once.debug({ url }, 'Could not get Google access token');
  }

  return {};
}

async function getUvExtraIndexUrl(
  sources: UvSources | undefined,
  indexes: UvIndexes | undefined,
  deps: Upgrade[],
): Promise<NodeJS.ProcessEnv> {
  const pyPiRegistryUrls = deps
    .filter((dep) => dep.datasource === PypiDatasource.id)
    .filter((dep) => {
      // Remove dependencies that are pinned to a specific index
      const packageName = dep.packageName!;
      return !sources || !(packageName in sources);
    })
    .flatMap((dep) => dep.registryUrls)
    .filter(isString)
    .filter((registryUrl) => {
      // Check if the registry URL is not the default one and not already configured
      const configuredIndexUrls = indexes?.map(({ url }) => url) ?? [];
      return (
        registryUrl !== PypiDatasource.defaultURL &&
        !configuredIndexUrls.includes(registryUrl)
      );
    });

  const registryUrls = new Set(pyPiRegistryUrls);
  const extraIndexUrls: string[] = [];

  for (const registryUrl of registryUrls) {
    const parsedUrl = parseUrl(registryUrl);
    if (!parsedUrl) {
      continue;
    }

    const { username, password } = await getUsernamePassword(parsedUrl);
    if (username || password) {
      if (username) {
        parsedUrl.username = username;
      }
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
  indexes: UvIndexes | undefined,
): Promise<NodeJS.ProcessEnv> {
  if (!indexes) {
    return {};
  }

  const entries = [];

  for (const { name, url } of indexes) {
    const parsedUrl = parseUrl(url);
    /* v8 ignore next 3 -- needs test */
    if (!parsedUrl) {
      continue;
    }

    // If no name is provided for the index, authentication information must be passed through alternative methods
    if (!name) {
      continue;
    }

    const { username, password } = await getUsernamePassword(parsedUrl);

    const NAME = name.toUpperCase().replace(/[^A-Z0-9]/g, '_');

    if (username) {
      entries.push([`UV_INDEX_${NAME}_USERNAME`, username]);
    }

    if (password) {
      entries.push([`UV_INDEX_${NAME}_PASSWORD`, password]);
    }
  }

  return Object.fromEntries(entries);
}
