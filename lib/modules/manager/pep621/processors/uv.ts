import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import type { HostRule } from '../../../../types';
import { exec } from '../../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../../util/exec/types';
import { getSiblingFileName, readLocalFile } from '../../../../util/fs';
import { getGitEnvironmentVariables } from '../../../../util/git/auth';
import { find } from '../../../../util/host-rules';
import { Result } from '../../../../util/result';
import { parseUrl } from '../../../../util/url';
import { PypiDatasource } from '../../../datasource/pypi';
import { getGoogleAuthHostRule } from '../../../datasource/util';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../../types';
import { applyGitSource } from '../../util';
import { type PyProject, UvLockfileSchema } from '../schema';
import { depTypes, parseDependencyList } from '../utils';
import type { PyProjectProcessor } from './types';

const uvUpdateCMD = 'uv lock';

export class UvProcessor implements PyProjectProcessor {
  process(project: PyProject, deps: PackageDependency[]): PackageDependency[] {
    const uv = project.tool?.uv;
    if (is.nullOrUndefined(uv)) {
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

    deps.push(
      ...parseDependencyList(
        depTypes.uvDevDependencies,
        uv['dev-dependencies'],
      ),
    );

    // https://docs.astral.sh/uv/concepts/dependencies/#dependency-sources
    // Skip sources that do not make sense to handle (e.g. path).
    if (uv.sources || defaultIndex || implicitIndexUrls) {
      for (const dep of deps) {
        // istanbul ignore if
        if (!dep.packageName) {
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

  async extractLockedVersions(
    project: PyProject,
    deps: PackageDependency[],
    packageFile: string,
  ): Promise<PackageDependency[]> {
    const lockFileName = getSiblingFileName(packageFile, 'uv.lock');
    const lockFileContent = await readLocalFile(lockFileName, 'utf8');
    if (lockFileContent) {
      const { val: lockFileMapping, err } = Result.parse(
        lockFileContent,
        UvLockfileSchema,
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

    return Promise.resolve(deps);
  }

  async updateArtifacts(
    updateArtifact: UpdateArtifact,
    project: PyProject,
  ): Promise<UpdateArtifactsResult[] | null> {
    const { config, updatedDeps, packageFileName } = updateArtifact;

    const isLockFileMaintenance = config.updateType === 'lockFileMaintenance';

    // abort if no lockfile is defined
    const lockFileName = getSiblingFileName(packageFileName, 'uv.lock');
    try {
      const existingLockFileContent = await readLocalFile(lockFileName, 'utf8');
      if (is.nullOrUndefined(existingLockFileContent)) {
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
        constraint: config.constraints?.uv,
      };

      const extraEnv = {
        ...getGitEnvironmentVariables(['pep621']),
        ...(await getUvExtraIndexUrl(project, updateArtifact.updatedDeps)),
        ...(await getUvIndexCredentials(project)),
      };
      const execOptions: ExecOptions = {
        cwdFile: packageFileName,
        extraEnv,
        docker: {},
        userConfiguredEnv: config.env,
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
      // istanbul ignore if
      if (err.message === TEMPORARY_ERROR) {
        throw err;
      }
      logger.debug({ err }, 'Failed to update uv lock file');
      return [
        {
          artifactError: {
            lockFile: lockFileName,
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
        deps.push(dep.depName!.split('/')[1]);
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
    } else {
      logger.once.debug({ url }, 'Could not get Google access token');
    }
  }

  return {};
}

async function getUvExtraIndexUrl(
  project: PyProject,
  deps: Upgrade[],
): Promise<NodeJS.ProcessEnv> {
  const pyPiRegistryUrls = deps
    .filter((dep) => dep.datasource === PypiDatasource.id)
    .filter((dep) => {
      // Remove dependencies that are pinned to a specific index
      const sources = project.tool?.uv?.sources;
      return !sources || !(dep.packageName! in sources);
    })
    .flatMap((dep) => dep.registryUrls)
    .filter(is.string)
    .filter((registryUrl) => {
      // Check if the registry URL is not the default one and not already configured
      const configuredIndexUrls =
        project.tool?.uv?.index?.map(({ url }) => url) ?? [];
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
  project: PyProject,
): Promise<NodeJS.ProcessEnv> {
  const uv_indexes = project.tool?.uv?.index;

  if (is.nullOrUndefined(uv_indexes)) {
    return {};
  }

  const entries = [];

  for (const { name, url } of uv_indexes) {
    const parsedUrl = parseUrl(url);
    // istanbul ignore if
    if (!parsedUrl) {
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
