import { ZodEffects, ZodType, ZodTypeDef, z } from 'zod';
import { parseGitUrl } from '../../../util/git/url';
import { regEx } from '../../../util/regex';
import { LooseArray, LooseRecord, Toml } from '../../../util/schema-utils';
import { uniq } from '../../../util/uniq';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PypiDatasource } from '../../datasource/pypi';
import * as pep440Versioning from '../../versioning/pep440';
import * as poetryVersioning from '../../versioning/poetry';
import { dependencyPattern } from '../pip_requirements/extract';
import type { PackageDependency, PackageFileContent } from '../types';

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
  });

const PoetryGitDependency = z
  .object({
    git: z.string(),
    tag: z.string().optional().catch(undefined),
    version: z.string().optional().catch(undefined),
  })
  .transform(({ git, tag, version }): PackageDependency => {
    if (!tag) {
      const res: PackageDependency = {
        datasource: GitRefsDatasource.id,
        packageName: git,
        skipReason: 'git-dependency',
      };

      if (version) {
        res.currentValue = version;
      }

      return res;
    }

    const parsedUrl = parseGitUrl(git);
    if (parsedUrl.source !== 'github.com') {
      return {
        datasource: GitRefsDatasource.id,
        currentValue: tag,
        packageName: git,
        skipReason: 'git-dependency',
      };
    }

    const { owner, name } = parsedUrl;
    const repo = `${owner}/${name}`;
    return {
      datasource: GithubTagsDatasource.id,
      currentValue: tag,
      packageName: repo,
    };
  });

const PoetryPypiDependency = z.union([
  z
    .object({ version: z.string().optional() })
    .transform(({ version: currentValue }): PackageDependency => {
      if (!currentValue) {
        return { datasource: PypiDatasource.id };
      }

      return {
        datasource: PypiDatasource.id,
        managerData: { nestedVersion: true },
        currentValue,
      };
    }),
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
      const pep503NormalizeRegex = regEx(/[-_.]+/g);
      const packageName = depName
        .toLowerCase()
        .replace(pep503NormalizeRegex, '-');
      if (depName !== packageName) {
        dep.packageName = packageName;
      }
    }
    deps.push(dep);
  }
  return deps;
});

function withDepType<
  Output extends PackageDependency[],
  Schema extends ZodType<Output, ZodTypeDef, unknown>,
>(schema: Schema, depType: string): ZodEffects<Schema> {
  return schema.transform((deps) => {
    for (const dep of deps) {
      dep.depType = depType;
    }
    return deps;
  });
}

export const PoetryGroupDependencies = LooseRecord(
  z.string(),
  z
    .object({ dependencies: PoetryDependencies })
    .transform(({ dependencies }) => dependencies),
).transform((record) => {
  const deps: PackageDependency[] = [];
  for (const [groupName, group] of Object.entries(record)) {
    for (const dep of Object.values(group)) {
      dep.depType = groupName;
      deps.push(dep);
    }
  }
  return deps;
});

export const PoetrySectionSchema = z
  .object({
    dependencies: withDepType(PoetryDependencies, 'dependencies').optional(),
    'dev-dependencies': withDepType(
      PoetryDependencies,
      'dev-dependencies',
    ).optional(),
    extras: withDepType(PoetryDependencies, 'extras').optional(),
    group: PoetryGroupDependencies.optional(),
    source: LooseArray(
      z
        .object({
          url: z.string(),
        })
        .transform(({ url }) => url),
    )
      .refine((urls) => urls.length > 0)
      .transform((urls) => [
        ...urls,
        process.env.PIP_INDEX_URL ?? 'https://pypi.org/pypi/',
      ])
      .transform((urls) => uniq(urls))
      .optional()
      .catch(undefined),
  })
  .transform(
    ({
      dependencies = [],
      'dev-dependencies': devDependencies = [],
      extras: extraDependencies = [],
      group: groupDependencies = [],
      source: registryUrls,
    }) => {
      const deps: PackageDependency[] = [
        ...dependencies,
        ...devDependencies,
        ...extraDependencies,
        ...groupDependencies,
      ];

      const res: PackageFileContent = { deps };

      if (registryUrls) {
        res.registryUrls = registryUrls;
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
  '2.0': '>=1.3.0',
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
