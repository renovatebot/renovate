import { z } from 'zod';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { Json, LooseArray, LooseRecord } from '../../../util/schema-utils';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PackagistDatasource } from '../../datasource/packagist';
import { api as semverComposer } from '../../versioning/composer';
import type { PackageDependency, PackageFileContent } from '../types';
import type { ComposerManagerData } from './types';

export const ComposerRepo = z.object({
  type: z.literal('composer'),
  url: z.string(),
});
export type ComposerRepo = z.infer<typeof ComposerRepo>;

export const GitRepo = z.object({
  type: z.enum(['vcs', 'git']).transform(() => 'git' as const),
  url: z.string(),
});
export type GitRepo = z.infer<typeof GitRepo>;

export const PathRepo = z.object({
  type: z.literal('path'),
  url: z.string(),
});
export type PathRepo = z.infer<typeof PathRepo>;

export const Repo = z.discriminatedUnion('type', [
  ComposerRepo,
  GitRepo,
  PathRepo,
]);
export type Repo = z.infer<typeof ComposerRepo>;

export const NamedRepo = z.discriminatedUnion('type', [
  ComposerRepo,
  GitRepo.extend({ name: z.string() }),
  PathRepo.extend({ name: z.string() }),
]);
export type NamedRepo = z.infer<typeof NamedRepo>;

const NoPackagist = z.literal(false).transform(() => null);
const NoPackagistMarker = z.object({
  type: z.literal('disable-packagist'),
});
export type NoPackagistMarker = z.infer<typeof NoPackagistMarker>;

export const ReposRecord = z
  .record(
    z.union([Repo, NoPackagist]).catch(({ error: err }) => {
      logger.warn({ err }, 'Composer: repository parsing error');
      return null;
    })
  )
  .transform((repos) => {
    const result: (NamedRepo | NoPackagistMarker)[] = [];
    for (const [name, repo] of Object.entries(repos)) {
      if (repo === null) {
        if (name === 'packagist' || name === 'packagist.org') {
          result.push({ type: 'disable-packagist' });
        }
      } else if (repo.type === 'path' || repo.type === 'git') {
        result.push({ name, ...repo });
      } else if (repo.type === 'composer') {
        result.push(repo);
      }
    }

    return result;
  });
export type ReposRecord = z.infer<typeof ReposRecord>;

export const ReposArray = z
  .array(
    z
      .union([
        NamedRepo,
        z
          .union([
            z.object({ packagist: NoPackagist }),
            z.object({ 'packagist.org': NoPackagist }),
          ])
          .transform((): NoPackagistMarker => ({ type: 'disable-packagist' })),
      ])
      .nullable()
      .catch(({ error: err }) => {
        logger.warn({ err }, 'Composer: repository parsing error');
        return null;
      })
  )
  .transform((repos) => repos.filter((x): x is NamedRepo => x !== null));
export type ReposArray = z.infer<typeof ReposArray>;

export const Repos = z
  .union([ReposRecord, ReposArray])
  .default([]) // Prevents packages without repositories from being logged
  .catch(({ error: err }) => {
    logger.warn({ err }, 'Composer: repositories parsing error');
    return [];
  })
  .transform((repos) => {
    let packagist = true;
    const registryUrls: string[] = [];
    const gitRepos: Record<string, GitRepo> = {};
    const pathRepos: Record<string, PathRepo> = {};

    for (const repo of repos) {
      if (repo.type === 'composer') {
        /**
         * The regUrl is expected to be a base URL. GitLab composer repository installation guide specifies
         * to use a base URL containing packages.json. Composer still works in this scenario by determining
         * whether to add / remove packages.json from the URL.
         *
         * See https://github.com/composer/composer/blob/750a92b4b7aecda0e5b2f9b963f1cb1421900675/src/Composer/Repository/ComposerRepository.php#L815
         */
        const url = repo.url.replace(/\/packages\.json$/, '');
        registryUrls.push(url);
      } else if (repo.type === 'git') {
        gitRepos[repo.name] = repo;
      } else if (repo.type === 'path') {
        pathRepos[repo.name] = repo;
      } else if (repo.type === 'disable-packagist') {
        packagist = false;
      }
    }

    if (packagist) {
      registryUrls.push('https://packagist.org');
    }

    return { registryUrls, gitRepos, pathRepos };
  });
export type Repos = z.infer<typeof Repos>;

const RequireDefs = LooseRecord(z.string().transform((x) => x.trim())).catch(
  {}
);

export const PackageFile = z
  .object({
    type: z.string().optional(),
    config: z
      .object({
        platform: z.object({
          php: z.string(),
        }),
      })
      .nullable()
      .catch(null),
    repositories: Repos,
    require: RequireDefs,
    'require-dev': RequireDefs,
  })
  .transform(
    ({
      type: composerJsonType,
      config,
      repositories,
      require,
      'require-dev': requireDev,
    }) => ({
      composerJsonType,
      config,
      repositories,
      require,
      requireDev,
    })
  );
export type PackageFile = z.infer<typeof PackageFile>;

const LockedPackage = z.object({
  name: z.string(),
  version: z.string(),
});
type LockedPackage = z.infer<typeof LockedPackage>;

export const Lockfile = z
  .object({
    'plugin-api-version': z.string().optional(),
    packages: LooseArray(LockedPackage).catch([]),
    'packages-dev': LooseArray(LockedPackage).catch([]),
  })
  .transform(
    ({
      'plugin-api-version': pluginApiVersion,
      packages,
      'packages-dev': packagesDev,
    }) => ({ pluginApiVersion, packages, packagesDev })
  );
export type Lockfile = z.infer<typeof Lockfile>;

export const ComposerExtract = z
  .object({
    content: z.string(),
    fileName: z.string(),
  })
  .transform(({ content, fileName }) => {
    const lockfileName = fileName.replace(/\.json$/, '.lock');
    return {
      file: content,
      lockfileName,
      lockfile: lockfileName,
    };
  })
  .pipe(
    z.object({
      file: Json.pipe(PackageFile),
      lockfileName: z.string(),
      lockfile: z
        .string()
        .transform((lockfileName) => readLocalFile(lockfileName, 'utf8'))
        .pipe(Json)
        .pipe(Lockfile)
        .nullable()
        .catch(({ error: err }) => {
          logger.warn({ err }, 'Composer: lockfile parsing error');
          return null;
        }),
    })
  )
  .transform(({ file, lockfile, lockfileName }) => {
    const { composerJsonType, require, requireDev } = file;
    const { registryUrls, gitRepos, pathRepos } = file.repositories;

    const deps: PackageDependency[] = [];

    const profiles = [
      {
        depType: 'require',
        req: require,
        locked: lockfile?.packages ?? [],
      },
      {
        depType: 'require-dev',
        req: requireDev,
        locked: lockfile?.packagesDev ?? [],
      },
    ];

    for (const { depType, req, locked } of profiles) {
      for (const [depName, currentValue] of Object.entries(req)) {
        if (depName === 'php') {
          deps.push({
            depType,
            depName,
            currentValue,
            datasource: GithubTagsDatasource.id,
            packageName: 'php/php-src',
            extractVersion: '^php-(?<version>.*)$',
          });
          continue;
        }

        if (pathRepos[depName]) {
          deps.push({
            depType,
            depName,
            currentValue,
            skipReason: 'path-dependency',
          });
          continue;
        }

        const dep: PackageDependency = {
          depType,
          depName,
          currentValue,
        };

        if (!depName.includes('/')) {
          dep.skipReason = 'unsupported';
        }

        const lockedDep = locked.find((item) => item.name === depName);
        if (lockedDep && semverComposer.isVersion(lockedDep.version)) {
          dep.lockedVersion = lockedDep.version.replace(regEx(/^v/i), '');
        }

        const gitRepo = gitRepos[depName];
        if (gitRepo) {
          dep.datasource = GitTagsDatasource.id;
          dep.packageName = gitRepo.url;
          deps.push(dep);
          continue;
        }

        dep.datasource = PackagistDatasource.id;
        dep.registryUrls = registryUrls;
        deps.push(dep);
      }
    }

    if (!deps.length) {
      return null;
    }

    const res: PackageFileContent<ComposerManagerData> = { deps };

    if (composerJsonType) {
      res.managerData = { composerJsonType };
    }

    if (require.php) {
      res.extractedConstraints = { php: require.php };
    }

    if (lockfile) {
      res.lockFiles = [lockfileName];
    }

    return res;
  });
export type ComposerExtract = z.infer<typeof ComposerExtract>;
