import { z } from 'zod';
import { logger } from '../../../logger';
import { getEnv } from '../../../util/env';
import { parseGitUrl } from '../../../util/git/url';
import { regEx } from '../../../util/regex';
import {
  LooseArray,
  LooseRecord,
  Toml,
  withDepType,
} from '../../../util/schema-utils';
import { uniq } from '../../../util/uniq';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { PypiDatasource } from '../../datasource/pypi';
import { normalizePythonDepName } from '../../datasource/pypi/common';
import * as gitVersioning from '../../versioning/git';
import * as pep440Versioning from '../../versioning/pep440';
import * as poetryVersioning from '../../versioning/poetry';
import { dependencyPattern } from '../pip_requirements/extract';
import type { PackageDependency, PackageFileContent } from '../types';

const PoetryOptionalDependencyMixin = z
  .object({
    optional: z.boolean().optional().catch(false),
  })
  .transform(
    ({ optional }): PackageDependency =>
      optional ? { depType: 'extras' } : {},
  );

const PoetryPathDependency = z
  .object({
    path: z.string(),
    version: z.string().optional().catch(undefined),
  })
  .transform(({ version }): PackageDependency => {
    const dep: PackageDependency = {
      datasource: PypiDatasource.id,
      skipReason: 'path-dependency',
    };

    if (version) {
      dep.currentValue = version;
    }

    return dep;
  })
  .and(PoetryOptionalDependencyMixin);

const PoetryGitDependency = z
  .object({
    git: z.string(),
    tag: z.string().optional().catch(undefined),
    version: z.string().optional().catch(undefined),
    branch: z.string().optional().catch(undefined),
    rev: z.string().optional().catch(undefined),
  })
  .transform(({ git, tag, version, branch, rev }): PackageDependency => {
    if (tag) {
      const { source, owner, name } = parseGitUrl(git);
      const repo = `${owner}/${name}`;
      if (source === 'github.com') {
        return {
          datasource: GithubTagsDatasource.id,
          currentValue: tag,
          packageName: repo,
        };
      } else if (source === 'gitlab.com') {
        return {
          datasource: GitlabTagsDatasource.id,
          currentValue: tag,
          packageName: repo,
        };
      } else {
        return {
          datasource: GitTagsDatasource.id,
          currentValue: tag,
          packageName: git,
        };
      }
    }

    if (rev) {
      return {
        datasource: GitRefsDatasource.id,
        currentValue: branch,
        currentDigest: rev,
        replaceString: rev,
        packageName: git,
      };
    }

    return {
      datasource: GitRefsDatasource.id,
      currentValue: version,
      packageName: git,
      skipReason: 'git-dependency',
    };
  })
  .and(PoetryOptionalDependencyMixin);

const PoetryPypiDependency = z.union([
  z
    .object({ version: z.string().optional(), source: z.string().optional() })
    .transform(({ version: currentValue, source }): PackageDependency => {
      if (!currentValue) {
        return { datasource: PypiDatasource.id };
      }

      return {
        datasource: PypiDatasource.id,
        managerData: {
          nestedVersion: true,
          ...(source ? { sourceName: source.toLowerCase() } : {}),
        },
        currentValue,
      };
    })
    .and(PoetryOptionalDependencyMixin),
  z.string().transform(
    (version): PackageDependency => ({
      datasource: PypiDatasource.id,
      currentValue: version,
      managerData: { nestedVersion: false },
    }),
  ),
]);

const PoetryArrayDependency = z.array(z.unknown()).transform(
  (): PackageDependency => ({
    datasource: PypiDatasource.id,
    skipReason: 'multiple-constraint-dep',
  }),
);

const PoetryDependency = z.union([
  PoetryPathDependency,
  PoetryGitDependency,
  PoetryPypiDependency,
  PoetryArrayDependency,
]);

export const PoetryDependencies = LooseRecord(
  z.string(),
  PoetryDependency.transform((dep) => {
    if (dep.skipReason) {
      return dep;
    }

    if (dep.datasource === GitRefsDatasource.id && dep.currentDigest) {
      dep.versioning = gitVersioning.id;
      return dep;
    }

    // istanbul ignore if: normaly should not happen
    if (!dep.currentValue) {
      dep.skipReason = 'unspecified-version';
      return dep;
    }

    if (pep440Versioning.isValid(dep.currentValue)) {
      dep.versioning = pep440Versioning.id;
      return dep;
    }

    if (poetryVersioning.isValid(dep.currentValue)) {
      dep.versioning = poetryVersioning.id;
      return dep;
    }

    dep.skipReason = 'invalid-version';
    return dep;
  }),
).transform((record) => {
  const deps: PackageDependency[] = [];
  for (const [depName, dep] of Object.entries(record)) {
    dep.depName = depName;
    if (!dep.packageName) {
      const packageName = normalizePythonDepName(depName);
      if (depName !== packageName) {
        dep.packageName = packageName;
      }
    }
    deps.push(dep);
  }
  return deps;
});

export const PoetryGroupDependencies = LooseRecord(
  z.string(),
  z
    .object({ dependencies: PoetryDependencies })
    .transform(({ dependencies }) => dependencies),
).transform((record) => {
  const deps: PackageDependency[] = [];
  for (const [name, val] of Object.entries(record)) {
    for (const dep of Object.values(val)) {
      dep.depType = name;
      deps.push(dep);
    }
  }
  return deps;
});

const PoetrySourceOrder = [
  'default',
  'primary',
  'secondary',
  'supplemental',
  'explicit',
] as const;

export const PoetrySource = z.object({
  name: z.string().toLowerCase(),
  url: z.string().optional(),
  priority: z.enum(PoetrySourceOrder).default('primary'),
});
export type PoetrySource = z.infer<typeof PoetrySource>;

export const PoetrySources = LooseArray(PoetrySource, {
  onError: ({ error: err }) => {
    logger.debug({ err }, 'Poetry: error parsing sources array');
  },
})
  .transform((sources) => {
    const pypiUrl = getEnv().PIP_INDEX_URL ?? 'https://pypi.org/pypi/';
    const result: PoetrySource[] = [];

    let overridesPyPi = false;
    let hasDefaultSource = false;
    let hasPrimarySource = false;
    for (const source of sources) {
      if (source.name === 'pypi') {
        source.url = pypiUrl;
        overridesPyPi = true;
      }

      if (!source.url) {
        continue;
      }

      if (source.priority === 'default') {
        hasDefaultSource = true;
      } else if (source.priority === 'primary') {
        hasPrimarySource = true;
      }

      result.push(source);
    }

    if (sources.length && !hasDefaultSource && !overridesPyPi) {
      result.push({
        name: 'pypi',
        priority: hasPrimarySource ? 'secondary' : 'default',
        url: pypiUrl,
      });
    }

    result.sort(
      (a, b) =>
        PoetrySourceOrder.indexOf(a.priority) -
        PoetrySourceOrder.indexOf(b.priority),
    );

    return result;
  })
  .catch([]);

export const PoetrySectionSchema = z
  .object({
    version: z.string().optional().catch(undefined),
    dependencies: withDepType(
      PoetryDependencies,
      'dependencies',
      false,
    ).optional(),
    'dev-dependencies': withDepType(
      PoetryDependencies,
      'dev-dependencies',
    ).optional(),
    group: PoetryGroupDependencies.optional(),
    source: PoetrySources,
  })
  .transform(
    ({
      version,
      dependencies = [],
      'dev-dependencies': devDependencies = [],
      group: groupDependencies = [],
      source: sourceUrls,
    }) => {
      const deps: PackageDependency[] = [
        ...dependencies,
        ...devDependencies,
        ...groupDependencies,
      ];

      const res: PackageFileContent = { deps, packageFileVersion: version };

      if (sourceUrls.length) {
        for (const dep of res.deps) {
          if (dep.managerData?.sourceName) {
            const sourceUrl = sourceUrls.find(
              ({ name }) => name === dep.managerData?.sourceName,
            );
            if (sourceUrl?.url) {
              dep.registryUrls = [sourceUrl.url];
            }
          }
        }

        const sourceUrlsFiltered = sourceUrls.filter(
          ({ priority }) => priority !== 'explicit',
        );
        res.registryUrls = uniq(sourceUrlsFiltered.map(({ url }) => url!));
      }

      return res;
    },
  );

export type PoetrySectionSchema = z.infer<typeof PoetrySectionSchema>;

const BuildSystemRequireVal = z
  .string()
  .nonempty()
  .transform((val) => regEx(`^${dependencyPattern}$`).exec(val))
  .transform((match, ctx) => {
    if (!match) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'invalid requirement',
      });
      return z.NEVER;
    }

    const [, depName, , poetryRequirement] = match;
    return { depName, poetryRequirement };
  });

export const PoetrySchema = z
  .object({
    tool: z
      .object({ poetry: PoetrySectionSchema })
      .transform(({ poetry }) => poetry),
    'build-system': z
      .object({
        'build-backend': z.string().refine(
          // https://python-poetry.org/docs/pyproject/#poetry-and-pep-517
          (buildBackend) =>
            buildBackend === 'poetry.masonry.api' ||
            buildBackend === 'poetry.core.masonry.api',
        ),
        requires: LooseArray(BuildSystemRequireVal).transform((vals) => {
          const req = vals.find(
            ({ depName }) => depName === 'poetry' || depName === 'poetry_core',
          );
          return req?.poetryRequirement;
        }),
      })
      .transform(({ requires: poetryRequirement }) => poetryRequirement)
      .optional()
      .catch(undefined),
  })
  .transform(
    ({ tool: packageFileContent, 'build-system': poetryRequirement }) => ({
      packageFileContent,
      poetryRequirement,
    }),
  );

export type PoetrySchema = z.infer<typeof PoetrySchema>;

export const PoetrySchemaToml = Toml.pipe(PoetrySchema);

const poetryConstraint: Record<string, string> = {
  '1.0': '<1.1.0',
  '1.1': '<1.3.0',
  '2.0': '>=1.3.0 <1.4.0', // 1.4.0 introduced embedding of the poetry version in lock file header
};

export const Lockfile = Toml.pipe(
  z.object({
    package: LooseArray(
      z
        .object({
          name: z.string(),
          version: z.string(),
        })
        .transform(({ name, version }): [string, string] => [name, version]),
    )
      .transform((entries) => Object.fromEntries(entries))
      .catch({}),
    metadata: z
      .object({
        'lock-version': z
          .string()
          .transform((lockVersion) => poetryConstraint[lockVersion])
          .optional()
          .catch(undefined),
        'python-versions': z.string().optional().catch(undefined),
      })
      .transform(
        ({
          'lock-version': poetryConstraint,
          'python-versions': pythonVersions,
        }) => ({
          poetryConstraint,
          pythonVersions,
        }),
      )
      .catch({
        poetryConstraint: undefined,
        pythonVersions: undefined,
      }),
  }),
).transform(
  ({ package: lock, metadata: { poetryConstraint, pythonVersions } }) => ({
    lock,
    poetryConstraint,
    pythonVersions,
  }),
);
