import is from '@sindresorhus/is';
import { quote } from 'shlex';
import { TEMPORARY_ERROR } from '../../../../constants/error-messages';
import { logger } from '../../../../logger';
import type { HostRule } from '../../../../types';
import { exec } from '../../../../util/exec';
import type { ExecOptions, ToolConstraint } from '../../../../util/exec/types';
import { getSiblingFileName, readLocalFile } from '../../../../util/fs';
import { parseGitUrl } from '../../../../util/git/url';
import { find } from '../../../../util/host-rules';
import { Result } from '../../../../util/result';
import { parseUrl } from '../../../../util/url';
import { GitRefsDatasource } from '../../../datasource/git-refs';
import { GitTagsDatasource } from '../../../datasource/git-tags';
import { GithubTagsDatasource } from '../../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../../datasource/gitlab-tags';
import { PypiDatasource } from '../../../datasource/pypi';
import type {
  PackageDependency,
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../../types';
import { type PyProject, type UvGitSource, UvLockfileSchema } from '../schema';
import { depTypes, parseDependencyList } from '../utils';
import type { PyProjectProcessor } from './types';

const uvUpdateCMD = 'uv lock';

export class UvProcessor implements PyProjectProcessor {
  process(project: PyProject, deps: PackageDependency[]): PackageDependency[] {
    const uv = project.tool?.uv;
    if (is.nullOrUndefined(uv)) {
      return deps;
    }

    deps.push(
      ...parseDependencyList(
        depTypes.uvDevDependencies,
        uv['dev-dependencies'],
      ),
    );

    // https://docs.astral.sh/uv/concepts/dependencies/#dependency-sources
    // Skip sources that do not make sense to handle (e.g. path).
    if (uv.sources) {
      for (const dep of deps) {
        if (!dep.depName) {
          continue;
        }

        const depSource = uv.sources[dep.depName];
        if (depSource) {
          dep.depType = depTypes.uvSources;
          if ('url' in depSource) {
            dep.skipReason = 'unsupported-url';
          } else if ('path' in depSource) {
            dep.skipReason = 'path-dependency';
          } else if ('workspace' in depSource) {
            dep.skipReason = 'inherited-dependency';
          } else {
            applyGitSource(dep, depSource);
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
        ...getUvExtraIndexUrl(updateArtifact.updatedDeps),
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

function applyGitSource(dep: PackageDependency, depSource: UvGitSource): void {
  const { git, rev, tag, branch } = depSource;
  if (tag) {
    const { source, full_name: repo } = parseGitUrl(git);
    if (source === 'github.com') {
      dep.datasource = GithubTagsDatasource.id;
      dep.packageName = repo;
    } else if (source === 'gitlab.com') {
      dep.datasource = GitlabTagsDatasource.id;
      dep.packageName = repo;
    } else {
      dep.datasource = GitTagsDatasource.id;
      dep.packageName = git;
    }
    dep.currentValue = tag;
    dep.skipReason = undefined;
  } else if (rev) {
    dep.datasource = GitRefsDatasource.id;
    dep.packageName = git;
    dep.currentDigest = rev;
    dep.replaceString = rev;
    dep.skipReason = undefined;
  } else {
    dep.datasource = GitRefsDatasource.id;
    dep.packageName = git;
    dep.currentValue = branch;
    dep.skipReason = branch ? 'git-dependency' : 'unspecified-version';
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

function getUvExtraIndexUrl(deps: Upgrade[]): NodeJS.ProcessEnv {
  const registryUrls = new Set(deps.map((dep) => dep.registryUrls).flat());
  const extraIndexUrls: string[] = [];

  for (const registryUrl of registryUrls) {
    const parsedUrl = parseUrl(registryUrl);
    if (!parsedUrl) {
      continue;
    }

    const rule = getMatchingHostRule(parsedUrl.toString());
    if (rule.username) {
      parsedUrl.username = rule.username;
    }
    if (rule.password) {
      parsedUrl.password = rule.password;
    }

    extraIndexUrls.push(parsedUrl.toString());
  }

  return {
    UV_EXTRA_INDEX_URL: extraIndexUrls.join(' '),
  };
}
